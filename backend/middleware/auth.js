import jwt from 'jsonwebtoken';
import supabase from '../lib/supabase.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, role, can_write')
      .eq('id', decoded.id)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
};

// FIX 4: 'member' can do anything 'author' can do (unified role)
export const requireRole = (...roles) => (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  // admin can do everything
  if (user.role === 'admin') return next();

  // writing routes: allow member + author + anyone with can_write=true
  const writingRoles = ['author', 'member'];
  const requestedWriting = roles.some(r => writingRoles.includes(r));
  if (requestedWriting && (writingRoles.includes(user.role) || user.can_write)) {
    return next();
  }

  if (roles.includes(user.role)) return next();

  return res.status(403).json({ error: 'Access denied' });
};
