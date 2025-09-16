import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { auth as fbAuth, db } from '../services/firebaseClient';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { classificationFromScores } from '../services/classification';

const AuthContext = createContext();

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  error: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        error: null
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        error: action.payload
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        error: null
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Listen for Firebase Auth changes and load profile
  useEffect(() => {
    const unsub = onAuthStateChanged(fbAuth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          let profile = snap.exists() ? snap.data() : { email: firebaseUser.email };

          // Always compute classification from recent scores; override stale profile value
          try {
            const scoresSnap = await getDocs(query(collection(db, 'scores'), where('competitorId', '==', firebaseUser.uid)));
            const scores = scoresSnap.docs.map(d => d.data());
            const cls = classificationFromScores(scores);
            if (cls) {
              profile = { ...profile, classification: cls };
              // Persist in background so other views stay consistent
              setDoc(doc(db, 'users', firebaseUser.uid), { classification: cls }, { merge: true }).catch(()=>{});
            }
          } catch {}
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user: { id: firebaseUser.uid, ...profile }, token }
          });
        } catch (e) {
          dispatch({ type: 'LOGIN_FAILURE', payload: e.message || 'Failed to load profile' });
        }
      } else {
        dispatch({ type: 'LOGOUT' });
      }
    });
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      await signInWithEmailAndPassword(fbAuth, email, password);
      return { success: true };
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: error.message || 'Login failed' });
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const register = async (userData) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const { email, password, username, firstName, lastName, role } = userData;
      const cred = await createUserWithEmailAndPassword(fbAuth, email, password);
      const profile = {
        email,
        username: username || email.split('@')[0],
        firstName: firstName || '',
        lastName: lastName || '',
        role: role || 'competitor',
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', cred.user.uid), profile, { merge: true });
      return { success: true };
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: error.message || 'Registration failed' });
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    await signOut(fbAuth);
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData });
  };

  const value = {
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    error: state.error,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!state.user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
