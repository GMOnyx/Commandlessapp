import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { verifyToken } from "@clerk/backend";
import { createHash } from "crypto";
import { maskSensitiveData } from "../utils/encryption";

const jwtSecret = process.env.JWT_SECRET || "your-fallback-secret-key";

// Debug environment variables on server startup
console.log('[AUTH STARTUP] Environment check:');
console.log('[AUTH STARTUP] CLERK_SECRET_KEY present:', !!process.env.CLERK_SECRET_KEY);
console.log('[AUTH STARTUP] CLERK_SECRET_KEY value:', process.env.CLERK_SECRET_KEY ? maskSensitiveData(process.env.CLERK_SECRET_KEY, 8) : 'undefined');
console.log('[AUTH STARTUP] NODE_ENV:', process.env.NODE_ENV);

// Function to convert Clerk user ID to UUID format for Supabase compatibility
export function clerkUserIdToUuid(clerkUserId: string): string {
  // Create a deterministic UUID from the Clerk user ID using SHA-256
  const hash = createHash('sha256').update(clerkUserId).digest('hex');
  
  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuid = [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32)
  ].join('-');
  
  return uuid;
}

// JWT-based functions (for backward compatibility)
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: "7d" });
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hashedPassword: string): boolean {
  return bcrypt.compareSync(password, hashedPassword);
}

// Enhanced authentication middleware that handles both JWT and Clerk tokens
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  console.log(`[AUTH] ${req.method} ${req.originalUrl || req.url}`, { 
    hasAuthHeader: !!authHeader, 
    hasToken: !!token,
    tokenPreview: token ? maskSensitiveData(token, 8) : 'none'
  });

  if (!token) {
    console.log('[AUTH] No token provided');
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    // Debug environment variable at runtime
    console.log('[AUTH] Runtime environment check:');
    console.log('[AUTH] CLERK_SECRET_KEY present at runtime:', !!process.env.CLERK_SECRET_KEY);
    console.log('[AUTH] CLERK_SECRET_KEY value at runtime:', process.env.CLERK_SECRET_KEY ? maskSensitiveData(process.env.CLERK_SECRET_KEY, 8) : 'undefined');
    
    // First, try to verify as a Clerk token
    if (process.env.CLERK_SECRET_KEY) {
      try {
        console.log('[AUTH] ✅ Clerk path: Attempting Clerk token verification...');
        console.log('[AUTH] Using CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? 'present' : 'missing');
        
        const sessionToken = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        
        if (sessionToken && sessionToken.sub) {
          const clerkUserId = sessionToken.sub;
          const supabaseUserId = clerkUserIdToUuid(clerkUserId);
          
          console.log('[AUTH] ✅ Clerk token verified successfully', { 
            clerkUserId: clerkUserId,
            supabaseUserId: supabaseUserId,
            exp: sessionToken.exp ? new Date(sessionToken.exp * 1000) : 'no exp'
          });
          
          // Add user info to request object for Clerk tokens
          (req as any).user = { 
            id: supabaseUserId, // Use UUID for Supabase compatibility
            clerkUserId: clerkUserId // Keep original Clerk ID for reference
          };
          return next();
        } else {
          console.log('[AUTH] ❌ Clerk token verification returned invalid result');
        }
      } catch (clerkError) {
        // If Clerk token verification fails, try JWT fallback
        console.log("[AUTH] ❌ Clerk token verification failed:");
        console.log("[AUTH] Error type:", clerkError instanceof Error ? clerkError.constructor.name : typeof clerkError);
        console.log("[AUTH] Error message:", clerkError instanceof Error ? clerkError.message : String(clerkError));
        // Don't log full error details which might contain sensitive data
      }
    } else {
      console.log('[AUTH] ⚠️ CLERK_SECRET_KEY not found at runtime, skipping Clerk verification');
    }

    // Fallback to JWT verification for backward compatibility
    try {
      console.log('[AUTH] Attempting JWT token verification...');
      const decoded = jwt.verify(token, jwtSecret) as any;
      console.log('[AUTH] ✅ JWT token verified successfully', { userId: decoded.userId });
      (req as any).user = { id: decoded.userId };
      next();
    } catch (jwtError) {
      const errorMessage = jwtError instanceof Error ? jwtError.message : String(jwtError);
      console.log('[AUTH] ❌ JWT token verification failed:', errorMessage);
      return res.status(403).json({ message: "Invalid or expired token" });
    }
  } catch (error) {
    console.error("[AUTH] ❌ Authentication error:", error);
    return res.status(500).json({ message: "Authentication service error" });
  }
}
