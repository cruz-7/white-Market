import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Input } from "./input";

interface PasswordStrength {
  hasLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [accessToken, setAccessToken] = useState("");

  // Extract token from URL hash (Supabase sends it there)
  const extractTokenFromHash = useCallback(() => {
    const hash = window.location.hash.substring(1); // Remove #
    const params = new URLSearchParams(hash);
    return params.get("access_token") || "";
  }, []);

  // Check token on mount
  useEffect(() => {
    // First check URL params, then hash
    const token = searchParams.get("access_token") || extractTokenFromHash();
    
    if (token) {
      setAccessToken(token);
      // For now, we'll assume the token is valid if present
      // The backend will validate it when submitting
      setTokenValid(true);
    } else {
      setTokenValid(false);
    }
  }, [searchParams, extractTokenFromHash]);

  // Password strength checker
  const getPasswordStrength = (pwd: string): PasswordStrength => ({
    hasLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
  });

  const pwdStrength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const canSubmit = 
    password.length > 0 && 
    confirmPassword.length > 0 && 
    pwdStrength.hasLength && 
    pwdStrength.hasUpper && 
    pwdStrength.hasLower && 
    pwdStrength.hasNumber &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      if (!pwdStrength.hasLength) toast.error("Password must be at least 8 characters");
      else if (!pwdStrength.hasUpper) toast.error("Password needs an uppercase letter");
      else if (!pwdStrength.hasLower) toast.error("Password needs a lowercase letter");
      else if (!pwdStrength.hasNumber) toast.error("Password needs a number");
      else if (!passwordsMatch) toast.error("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      // Import dynamically to avoid issues
      const { authApi } = await import("./api");
      const { error } = await authApi.resetPassword(accessToken, password);
      
      if (error) {
        toast.error(error);
        return;
      }

      setSuccess(true);
      toast.success("Password reset successful!");
      
      // Redirect to login after a delay
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (err) {
      toast.error("Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-7 h-7 text-red-600" />
            </div>
            <CardTitle className="text-xl">Invalid Reset Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/auth">
              <Button className="w-full">Go to Login</Button>
            </Link>
            <Link to="/forgot-password">
              <Button variant="outline" className="w-full">
                Request New Reset Link
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <CardTitle className="text-xl">Password Reset Complete!</CardTitle>
            <CardDescription>
              Your password has been successfully reset
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth">
              <Button className="w-full">Sign In with New Password</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <Card className="shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-7 h-7 text-purple-600" />
            </div>
            <CardTitle className="text-2xl">Set New Password</CardTitle>
            <CardDescription>
              Create a strong password for your account
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password field */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Password requirements */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className={`text-xs flex items-center gap-1 ${pwdStrength.hasLength ? 'text-green-600' : 'text-gray-400'}`}>
                    {pwdStrength.hasLength ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    8+ characters
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${pwdStrength.hasUpper ? 'text-green-600' : 'text-gray-400'}`}>
                    {pwdStrength.hasUpper ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    Uppercase
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${pwdStrength.hasLower ? 'text-green-600' : 'text-gray-400'}`}>
                    {pwdStrength.hasLower ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    Lowercase
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${pwdStrength.hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                    {pwdStrength.hasNumber ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    Number
                  </div>
                </div>
              </div>

              {/* Confirm password field */}
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11"
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-500">Passwords don't match</p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Passwords match
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-11" 
                disabled={loading || !canSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Don't want to change?{" "}
              <Link to="/auth" className="text-purple-600 hover:underline font-medium">
                Go back
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
