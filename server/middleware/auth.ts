import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret_commandhub_jwt";

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // For demo purposes, we'll bypass authentication and set a mock user
  // This simulates as if the user is already logged in
  const demoUser = await storage.getUserByUsername("demo");
  
  // If demo user doesn't exist, create one
  if (!demoUser) {
    const user = await storage.createUser({
      username: "demo",
      password: hashPassword("password123"),
      name: "Demo User",
      email: "demo@example.com",
      role: "Admin",
      avatar: null
    });
    (req as any).user = user;
  } else {
    (req as any).user = demoUser;
  }
  
  next();
  
  // In a production environment, we would use the code below:
  /*
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication token is required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(403).json({ message: "Invalid user" });
    }
    
    // Add user to request object
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
  */
}

export function hashPassword(password: string): string {
  // In a real app, we would use bcrypt or similar
  // This is just a simple implementation for demo purposes
  return `hashed_${password}`;
}

export function comparePassword(plainPassword: string, hashedPassword: string): boolean {
  // In a real app, we would use bcrypt.compare or similar
  return hashedPassword === `hashed_${plainPassword}`;
}
