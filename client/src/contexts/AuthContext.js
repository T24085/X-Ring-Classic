import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { auth as fbAuth, db } from '../services/firebaseClient';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { classificationFromScores } from '../services/classification';
import { ensureRecurringCompetitions } from '../services/recurringCompetitions';

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

// Firebase authentication and the user's Firestore profile are separate
// resources. A profile read failure should not turn a successful login into
// an authentication failure.
const loadAuthenticatedUser = async (firebaseUser) => {
  let token = null;
  try {
    token = await firebaseUser.getIdToken();
  } catch (error) {
    console.warn('Unable to refresh Firebase ID token:', error);
  }

  let profile = { email: firebaseUser.email || '' };
  try {
    const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (snap.exists()) {
      profile = { ...profile, ...snap.data() };
    }
  } catch (error) {
    console.warn('Unable to load user profile; continuing with Firebase account:', error);
  }

  // Classification is supplemental profile data. It must never block auth.
  try {
    const scoresSnap = await getDocs(query(collection(db, 'scores'), where('competitorId', '==', firebaseUser.uid)));
    const scores = scoresSnap.docs.map(d => d.data());
    const clsResult = classificationFromScores(scores);
    if (clsResult) {
      const classificationLabel = clsResult.tier || clsResult.classificationLabel || profile.classification;
      profile = { ...profile, classification: classificationLabel };
      setDoc(doc(db, 'users', firebaseUser.uid), { classification: classificationLabel }, { merge: true }).catch(() => {});
    }
  } catch (error) {
    console.warn('Unable to refresh classification; continuing with profile:', error);
  }

  return {
    user: { id: firebaseUser.uid, ...profile },
    token,
  };
};

const scheduleRecurringCompetitions = (user) => {
  if (!['admin', 'range_admin'].includes(user?.role)) return;
  ensureRecurringCompetitions(user).catch((error) => {
    console.warn('Unable to ensure recurring competitions:', error);
  });
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Listen for Firebase Auth changes and load profile data without allowing
  // Firestore/profile issues to invalidate a valid Firebase session.
  useEffect(() => {
    const unsub = onAuthStateChanged(fbAuth, async (firebaseUser) => {
      if (!firebaseUser) {
        dispatch({ type: 'LOGOUT' });
        return;
      }

      const { user, token } = await loadAuthenticatedUser(firebaseUser);
      if (token) localStorage.setItem('token', token);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
      scheduleRecurringCompetitions(user);
    });
    return () => unsub();
  }, []);

  const login = async (email, password) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const credential = await signInWithEmailAndPassword(fbAuth, email, password);
      const { user, token } = await loadAuthenticatedUser(credential.user);
      if (token) localStorage.setItem('token', token);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
      scheduleRecurringCompetitions(user);
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
      try {
        await setDoc(doc(db, 'users', cred.user.uid), profile, { merge: true });
      } catch (profileError) {
        // The Firebase account is already valid even if the profile write is
        // temporarily unavailable. Do not report a false registration error.
        console.warn('Account created but profile could not be saved:', profileError);
      }
      const token = await cred.user.getIdToken().catch(() => null);
      if (token) localStorage.setItem('token', token);
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user: { id: cred.user.uid, ...profile }, token },
      });
      return { success: true };
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: error.message || 'Registration failed' });
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      await signOut(fbAuth);
    } finally {
      localStorage.removeItem('token');
      dispatch({ type: 'LOGOUT' });
    }
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
