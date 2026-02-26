import { Router } from "express";
import { supabase, supabasePublic } from "../lib/supabaseClient.js";

const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const { email, password, full_name } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return res.status(400).json({ error: error.message });

  const user = data.user;
  if (!user) {
    return res.status(500).json({ error: "User creation returned no user object" });
  }

  const { error: confirmError } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });
  if (confirmError) {
    await supabase.auth.admin.deleteUser(user.id);
    return res.status(400).json({ error: confirmError.message });
  }

  const { error: profileError } = await supabase.from("users").insert({
    id: user.id,
    email,
    full_name: full_name || null,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(user.id);
    return res.status(400).json({ error: profileError.message });
  }

  return res.status(201).json({ message: "User created successfully", user });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });

  if (error) return res.status(401).json({ error: error.message });

  return res.json({
    access_token: data.session?.access_token,
    user: data.user,
  });
});

// Admin endpoint to confirm user email
authRouter.post("/confirm-email", async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  // First get the user by email
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    return res.status(400).json({ error: listError.message });
  }

  const user = users.users.find(u => u.email === email);
  
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Confirm the email
  const { error: confirmError } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
  });

  if (confirmError) {
    return res.status(400).json({ error: confirmError.message });
  }

  return res.json({ message: "Email confirmed successfully", user });
});
export default authRouter;

