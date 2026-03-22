import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Input } from "./input";
import { authApi } from "./api";

interface PasswordStrength {
  hasLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password strength checker
  const getPasswordStrength = (pwd: string): PasswordStrength => ({
    hasLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
  });

  const pwdStrength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const canSubmit = 
    currentPassword.length > 0 &&
    newPassword.length > 0 && 
    confirmPassword.length > 0 && 
    pwdStrength.hasLength && 
    pwdStrength.hasUpper && 
    pwdStrength.hasLower && 
    pwdStrength.hasNumber &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      if (!currentPassword) toast.error("Please enter your current password");
      else if (!pwdStrength.hasLength) toast.error("New password must be at least 8 characters");
      else if (!pwdStrength.hasUpper) toast.error("New password needs an uppercase letter");
      else if (!pwdStrength.hasLower) toast.error("New password needs a lowercase letter");
      else if (!pwdStrength.hasNumber) toast.error("New password needs a number");
      else if (!passwordsMatch) toast.error("New passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authApi.changePassword(currentPassword, newPassword);
      
      if (error) {
        toast.error(error);
        return;
      }

      setSuccess(true);
      toast.success("Password changed successfully!");
      
      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error("Failed to change password. Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-green-600" />
            </div>
            <CardTitle className="text-xl">Password Changed!</CardTitle>
            <CardDescription>
              Your password has been updated successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => navigate(-1)} className="w-full">
              Go Back
            </Button>
            <Button onClick={() => {
              setSuccess(false);
            }} variant="outline" className="w-full">
              Change Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>

        <Card className="shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-7 h-7 text-purple-600" />
            </div>
            <CardTitle className="text-2xl">Change Password</CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current password */}
              <div className="space-y-2">
                <label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">
                  Current Password
                </label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-11"
                  autoComplete="current-password"
                />
              </div>

              {/* New password field */}
              <div className="space-y-2">
                <label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                  Confirm New Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
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
                    Changing...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </form>

            {/* Security tips */}
            <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="text-sm font-medium text-amber-800 mb-2">Security Tips</h4>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Use a unique password you don't use elsewhere</li>
                <li>• Consider using a password manager</li>
                <li>• Never share your password with anyone</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
