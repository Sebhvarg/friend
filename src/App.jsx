import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import './App.css'

function App() {
  const [names, setNames] = useState([])
  const [myName, setMyName] = useState('')
  const [secretFriend, setSecretFriend] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "names"), (snapshot) => {
      const namesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNames(namesList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching names: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [])

  // FIX: Only reset if we are NOT currently showing a result.
  // If secretFriend is set, we want to keep showing it even if 'hasPicked' becomes true.
  useEffect(() => {
    if (myName && !secretFriend) {
      const user = names.find(n => n.id === myName);
      // If the user was deleted or has already picked (and we aren't showing the result yet), reset.
      if (!user || user.hasPicked) {
        setMyName('');
      }
    }
  }, [names, myName, secretFriend]);

  const handlePick = async () => {
    if (!myName) return;

    const potentialFriends = names.filter(n => 
      n.id !== myName && !n.isPicked
    );
    
    if (potentialFriends.length === 0) {
      alert("¡No quedan amigos disponibles para escoger!");
      return;
    }

    const randomIndex = Math.floor(Math.random() * potentialFriends.length);
    const selectedFriend = potentialFriends[randomIndex];

    try {
      await runTransaction(db, async (transaction) => {
        const myRef = doc(db, "names", myName);
        const friendRef = doc(db, "names", selectedFriend.id);

        const myDoc = await transaction.get(myRef);
        const friendDoc = await transaction.get(friendRef);

        if (!myDoc.exists() || !friendDoc.exists()) {
          throw new Error("Document does not exist!");
        }

        if (myDoc.data().hasPicked) {
          throw new Error("¡Ya has escogido a tu amigo secreto!");
        }

        if (friendDoc.data().isPicked) {
          throw new Error("¡Esta persona ya fue escogida! Intenta de nuevo.");
        }

        transaction.update(myRef, { hasPicked: true });
        transaction.update(friendRef, { isPicked: true });
      });

      setSecretFriend(selectedFriend);

    } catch (e) {
      console.error("Transaction failed: ", e);
      alert("Error: " + e.message);
    }
  }

  const handleCloseModal = () => {
    setSecretFriend(null);
    setMyName(''); // Reset everything so the next person can pick
  }

  if (loading) return <div>Cargando ...</div>

  // Filter: Show users who haven't picked yet
  const availablePickers = names.filter(n => !n.hasPicked);

  return (
    <div className="container">
      <h1>Amigo secreto (Gracias Brad por la Chocolatada)</h1>
      
      <div className="card">
        <label htmlFor="myName">Yo soy: </label>
        <select 
          id="myName" 
          value={myName} 
          onChange={(e) => setMyName(e.target.value)}
        >
          <option value="">Selecciona tu nombre</option>
          {availablePickers.map(n => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>

        <button onClick={handlePick} disabled={!myName}>
          Escoge a tu amigo secreto
        </button>
      </div>

      {/* POPUP / MODAL */}
      {secretFriend && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Tu amigo secreto es...</h2>
            <p className="friend-name">{secretFriend.name}</p>
            <p className="note">¡Shhh! Es un secreto no le digas a nadie owo</p>
            <button onClick={handleCloseModal}>
              Anotado
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
