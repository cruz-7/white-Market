import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Lock, Bell, Shield, LogOut, ChevronRight, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Palette, Globe, Trash2, Download, Moon, Sun, Share2, Database } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { Input } from "./input";
import { authApi } from "./api";
import { useSettings, Theme, ColorScheme, NotificationSettings, PrivacySettings } from "./SettingsContext";
import { Language, languageNames, languageFlags } from "./i18n";

interface UserData { id: string; email?: string; full_name?: string; avatar_url?: string; campus?: string; role?: string; }
interface PasswordStrength { hasLength: boolean; hasUpper: boolean; hasLower: boolean; hasNumber: boolean; }
type SettingsTab = "profile" | "password" | "notifications" | "privacy" | "theme" | "language" | "danger";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { translations } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("wm_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { navigate("/auth"); }
    } else { navigate("/auth"); }
  }, [navigate]);

  if (!user) return null;

  const tabs = [
    { id: "profile" as const, label: translations.editProfile, icon: User },
    { id: "password" as const, label: translations.changePasswordTab, icon: Lock },
    { id: "notifications" as const, label: translations.notificationsTab, icon: Bell },
    { id: "privacy" as const, label: translations.privacy, icon: Shield },
    { id: "theme" as const, label: translations.theme, icon: Palette },
    { id: "language" as const, label: translations.language, icon: Globe },
    { id: "danger" as const, label: translations.dangerZone, icon: Trash2 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{translations.settings}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{translations.manageAccount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1">
            <Card className="shadow-sm dark:bg-slate-800">
              <CardContent className="p-2">
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${activeTab === tab.id ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                    <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? "text-purple-600 dark:text-purple-400" : "text-slate-400 dark:text-slate-500"}`} />
                    <div className="flex-1"><p className={`font-medium ${activeTab === tab.id ? "text-purple-700 dark:text-purple-300" : "text-slate-700 dark:text-slate-200"}`}>{tab.label}</p></div>
                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </button>
                ))}
                <hr className="my-2 border-slate-200 dark:border-slate-700" />
                <button onClick={() => { localStorage.removeItem("wm_user"); window.dispatchEvent(new Event("wm-auth-change")); navigate("/"); toast.success(translations.success); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                  <LogOut className="w-5 h-5" /><span className="font-medium">{translations.logout}</span>
                </button>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-3">
            {activeTab === "profile" && <ProfileSettings user={user} />}
            {activeTab === "password" && <PasswordSettings />}
            {activeTab === "notifications" && <NotificationSettingsComponent />}
            {activeTab === "privacy" && <PrivacySettingsComponent />}
            {activeTab === "theme" && <ThemeSettingsComponent />}
            {activeTab === "language" && <LanguageSettingsComponent />}
            {activeTab === "danger" && <DangerZoneSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSettings({ user }: { user: UserData }) {
  const navigate = useNavigate();
  const { translations } = useSettings();

  return (
    <Card className="shadow-sm dark:bg-slate-800">
      <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-purple-600 dark:text-purple-400" />{translations.editProfile}</CardTitle><CardDescription className="dark:text-slate-400">Update your personal information</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
            {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" /> : <User className="w-8 h-8 text-purple-600 dark:text-purple-400" />}
          </div>
          <div className="flex-1"><p className="font-semibold text-slate-900 dark:text-white">{user?.full_name}</p><p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p></div>
        </div>
        <Button onClick={() => navigate('/profile-setup')} className="w-full">{translations.editProfile}</Button>
      </CardContent>
    </Card>
  );
}

function PasswordSettings() {
  const { translations } = useSettings();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const getPasswordStrength = (pwd: string): PasswordStrength => ({ hasLength: pwd.length >= 8, hasUpper: /[A-Z]/.test(pwd), hasLower: /[a-z]/.test(pwd), hasNumber: /[0-9]/.test(pwd) });
  const pwdStrength = getPasswordStrength(newPwd);
  const passwordsMatch = newPwd === confirmPwd && newPwd.length > 0;
  const canSubmit = currentPassword.length > 0 && newPwd.length > 0 && confirmPwd.length > 0 && pwdStrength.hasLength && pwdStrength.hasUpper && pwdStrength.hasLower && pwdStrength.hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { error } = await authApi.changePassword(currentPassword, newPwd);
      if (error) { toast.error(error); return; }
      setSuccess(true); setCurrentPassword(""); setNewPwd(""); setConfirmPwd("");
      toast.success(translations.success); setTimeout(() => setSuccess(false), 3000);
    } catch (err) { toast.error(translations.error); } finally { setLoading(false); }
  };

  return (
    <Card className="shadow-sm dark:bg-slate-800">
      <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-purple-600 dark:text-purple-400" />{translations.changePasswordTab}</CardTitle><CardDescription className="dark:text-slate-400">Keep your account secure</CardDescription></CardHeader>
      <CardContent>
        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" /></div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{translations.success}!</h3>
            <p className="text-slate-500 dark:text-slate-400">Your password has been updated successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="currentPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">{translations.currentPassword}</label>
              <Input id="currentPassword" type="password" placeholder="Enter current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-11 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
            </div>
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">{translations.newPassword}</label>
              <div className="relative">
                <Input id="newPassword" type={showPassword ? "text" : "password"} placeholder="Create a strong password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="h-11 pr-10 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className={`text-xs flex items-center gap-1 ${pwdStrength.hasLength ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>{pwdStrength.hasLength ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}8+ characters</div>
                <div className={`text-xs flex items-center gap-1 ${pwdStrength.hasUpper ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>{pwdStrength.hasUpper ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}Uppercase</div>
                <div className={`text-xs flex items-center gap-1 ${pwdStrength.hasLower ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>{pwdStrength.hasLower ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}Lowercase</div>
                <div className={`text-xs flex items-center gap-1 ${pwdStrength.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>{pwdStrength.hasNumber ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}Number</div>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm New Password</label>
              <Input id="confirmPassword" type="password" placeholder="Confirm your new password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} className="h-11 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
              {confirmPwd.length > 0 && !passwordsMatch && <p className="text-xs text-red-500">Passwords don't match</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading || !canSubmit}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing...</> : translations.changePasswordTab}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationSettingsComponent() {
  const { translations, settings, updateNotificationSettings } = useSettings();
  
  const toggleSetting = (key: keyof NotificationSettings) => {
    updateNotificationSettings({ [key]: !settings.notifications[key] });
    toast.success(translations.settingsSaved);
  };

  return (
    <Card className="shadow-sm dark:bg-slate-800">
      <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />{translations.notificationsTab}</CardTitle><CardDescription className="dark:text-slate-400">Choose what updates you want to receive</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{translations.pushNotifications}</h4>
          <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
            <div><p className="font-medium text-slate-900 dark:text-white">{translations.pushNotifications}</p><p className="text-sm text-slate-500 dark:text-slate-400">Receive push notifications on your device</p></div>
            <button onClick={() => toggleSetting("pushNotifications")} className={`relative w-12 h-6 rounded-full transition-colors ${settings.notifications.pushNotifications ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-600"}`} aria-label="Toggle push notifications">
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.notifications.pushNotifications ? "left-7" : "left-1"}`} />
            </button>
          </div>
        </div>
        <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{translations.emailAlerts}</h4>
          {[
            { key: "orderUpdates" as const, label: translations.orderUpdates, desc: "Get notified about order status changes" },
            { key: "newMessages" as const, label: translations.newMessages, desc: "Receive alerts when you get new messages" },
            { key: "promotions" as const, label: translations.promotions, desc: "Get deals and promotional offers" },
            { key: "referralUpdates" as const, label: translations.referralUpdates, desc: "Know when you earn referral rewards" }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
              <div><p className="font-medium text-slate-900 dark:text-white">{item.label}</p><p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p></div>
              <button onClick={() => toggleSetting(item.key)} className={`relative w-12 h-6 rounded-full transition-colors ${settings.notifications[item.key] ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-600"}`} aria-label={`Toggle ${item.label}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.notifications[item.key] ? "left-7" : "left-1"}`} />
              </button>
            </div>
          ))}
        </div>
        <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{translations.smsNotifications}</h4>
          <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
            <div><p className="font-medium text-slate-900 dark:text-white">{translations.smsNotifications}</p><p className="text-sm text-slate-500 dark:text-slate-400">Receive text messages for important updates</p></div>
            <button onClick={() => toggleSetting("smsNotifications")} className={`relative w-12 h-6 rounded-full transition-colors ${settings.notifications.smsNotifications ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-600"}`} aria-label="Toggle SMS notifications">
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.notifications.smsNotifications ? "left-7" : "left-1"}`} />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PrivacySettingsComponent() {
  const { translations, settings, updatePrivacySettings } = useSettings();
  
  const handleVisibilityChange = (value: 'public' | 'friends' | 'private') => {
    updatePrivacySettings({ profileVisibility: value });
    toast.success(translations.settingsSaved);
  };
  
  const toggleSetting = (key: keyof PrivacySettings) => {
    updatePrivacySettings({ [key]: !settings.privacy[key] });
    toast.success(translations.settingsSaved);
  };

  const visibilityOptions = [
    { value: "public" as const, label: translations.public, desc: "Anyone can see your profile" },
    { value: "friends" as const, label: translations.friendsOnly, desc: "Only verified users can see your profile" },
    { value: "private" as const, label: translations.private, desc: "Only you can see your profile" },
  ];

  return (
    <Card className="shadow-sm dark:bg-slate-800">
      <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />{translations.privacy}</CardTitle><CardDescription className="dark:text-slate-400">Control your visibility and data sharing</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{translations.profileVisibility}</h4>
          {visibilityOptions.map((option) => (
            <button key={option.value} onClick={() => handleVisibilityChange(option.value)}
              className={`flex items-center justify-between p-4 border rounded-lg w-full mb-2 ${settings.privacy.profileVisibility === option.value ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30" : "border-slate-200 dark:border-slate-600 hover:border-slate-300"}`}>
              <div className="text-left"><p className="font-medium text-slate-900 dark:text-white">{option.label}</p><p className="text-sm text-slate-500 dark:text-slate-400">{option.desc}</p></div>
              {settings.privacy.profileVisibility === option.value && <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
            </button>
          ))}
        </div>
        <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Contact Information</h4>
          <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-lg mb-2">
            <div><p className="font-medium text-slate-900 dark:text-white">{translations.showEmail}</p><p className="text-sm text-slate-500 dark:text-slate-400">Allow others to see your email</p></div>
            <button onClick={() => toggleSetting("showEmail")} className={`relative w-12 h-6 rounded-full transition-colors ${settings.privacy.showEmail ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-600"}`} aria-label="Toggle show email">
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.privacy.showEmail ? "left-7" : "left-1"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
            <div><p className="font-medium text-slate-900 dark:text-white">{translations.showPhone}</p><p className="text-sm text-slate-500 dark:text-slate-400">Allow others to see your phone</p></div>
            <button onClick={() => toggleSetting("showPhone")} className={`relative w-12 h-6 rounded-full transition-colors ${settings.privacy.showPhone ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-600"}`} aria-label="Toggle show phone">
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.privacy.showPhone ? "left-7" : "left-1"}`} />
            </button>
          </div>
        </div>
        <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{translations.dataSharing}</h4>
          <div className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
            <div className="flex items-center gap-3"><Share2 className="w-5 h-5 text-slate-400 dark:text-slate-500" /><div><p className="font-medium text-slate-900 dark:text-white">{translations.dataSharing}</p><p className="text-sm text-slate-500 dark:text-slate-400">Help us improve by sharing usage data</p></div></div>
            <button onClick={() => toggleSetting("dataSharing")} className={`relative w-12 h-6 rounded-full transition-colors ${settings.privacy.dataSharing ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-600"}`} aria-label="Toggle data sharing">
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.privacy.dataSharing ? "left-7" : "left-1"}`} />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeSettingsComponent() {
  const { translations, theme, colorScheme, setTheme, setColorScheme } = useSettings();
  
  const themes: { value: Theme; label: string; icon: typeof Sun; desc: string }[] = [
    { value: "light", label: translations.lightMode, icon: Sun, desc: "Clean and bright appearance" },
    { value: "dark", label: translations.darkMode, icon: Moon, desc: "Easy on the eyes in low light" },
    { value: "system", label: translations.systemTheme, icon: Palette, desc: "Follow your device settings" },
  ];
  
  const colorSchemes: { value: ColorScheme; label: string; color: string }[] = [
    { value: "purple", label: "Purple", color: "bg-purple-500" },
    { value: "blue", label: "Blue", color: "bg-blue-500" },
    { value: "green", label: "Green", color: "bg-green-500" },
    { value: "orange", label: "Orange", color: "bg-orange-500" },
    { value: "red", label: "Red", color: "bg-red-500" },
  ];

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    toast.success(translations.themeChanged);
  };

  const handleColorChange = (newColor: ColorScheme) => {
    setColorScheme(newColor);
    toast.success(translations.settingsSaved);
  };

  return (
    <Card className="shadow-sm dark:bg-slate-800">
      <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-purple-600 dark:text-purple-400" />{translations.theme}</CardTitle><CardDescription className="dark:text-slate-400">Customize the appearance of your app</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{translations.appearance}</h4>
          {themes.map((t) => (
            <button key={t.value} onClick={() => handleThemeChange(t.value)}
              className={`flex items-center justify-between p-4 border rounded-lg w-full mb-2 ${theme === t.value ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30" : "border-slate-200 dark:border-slate-600 hover:border-slate-300"}`}>
              <div className="flex items-center gap-3"><t.icon className={`w-5 h-5 ${theme === t.value ? "text-purple-600 dark:text-purple-400" : "text-slate-400"}`} /><div className="text-left"><p className="font-medium text-slate-900 dark:text-white">{t.label}</p><p className="text-sm text-slate-500 dark:text-slate-400">{t.desc}</p></div></div>
              {theme === t.value && <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
            </button>
          ))}
        </div>
        <div><h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{translations.accentColor}</h4>
          <div className="grid grid-cols-5 gap-2">
            {colorSchemes.map((c) => (
              <button key={c.value} onClick={() => handleColorChange(c.value)}
                className={`p-4 rounded-lg border-2 ${colorScheme === c.value ? "border-slate-900 dark:border-white scale-110" : "border-slate-200 dark:border-slate-600 hover:border-slate-300"}`}>
                <div className={`w-8 h-8 rounded-full ${c.color} mx-auto`} /><p className="text-xs text-center mt-2 text-slate-600 dark:text-slate-400">{c.label}</p>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LanguageSettingsComponent() {
  const { translations, language, setLanguage } = useSettings();
  
  const languages: { value: Language; label: string; flag: string }[] = [
    { value: "en", label: languageNames.en, flag: languageFlags.en },
    { value: "tw", label: languageNames.tw, flag: languageFlags.tw },
    { value: "ga", label: languageNames.ga, flag: languageFlags.ga },
    { value: "fr", label: languageNames.fr, flag: languageFlags.fr },
    { value: "es", label: languageNames.es, flag: languageFlags.es },
  ];

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    toast.success(translations.languageChanged);
  };

  return (
    <Card className="shadow-sm dark:bg-slate-800">
      <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />{translations.language}</CardTitle><CardDescription className="dark:text-slate-400">Choose your preferred language</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {languages.map((lang) => (
          <button key={lang.value} onClick={() => handleLanguageChange(lang.value)}
            className={`flex items-center justify-between p-4 border rounded-lg w-full ${language === lang.value ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30" : "border-slate-200 dark:border-slate-600 hover:border-slate-300"}`}>
            <div className="flex items-center gap-3"><span className="text-2xl">{lang.flag}</span><p className="font-medium text-slate-900 dark:text-white">{lang.label}</p></div>
            {language === lang.value && <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function DangerZoneSettings() {
  const { translations } = useSettings();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleExportData = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success(translations.success);
    } catch {
      toast.error(translations.error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      localStorage.removeItem("wm_user");
      localStorage.removeItem("wm_settings");
      window.dispatchEvent(new Event("wm-auth-change"));
      toast.success(translations.success);
      navigate("/");
    } catch {
      toast.error(translations.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-red-200 dark:border-red-800 dark:bg-slate-800">
      <CardHeader><CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400"><Trash2 className="w-5 h-5" />{translations.dangerZone}</CardTitle><CardDescription className="text-red-500 dark:text-red-400">These actions are irreversible.</CardDescription></CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{translations.exportData}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Download all your data</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleExportData} disabled={loading} className="dark:border-slate-600 dark:text-white dark:hover:bg-slate-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 mr-2" />Export</>}
            </Button>
          </div>
        </div>
        <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-500 dark:text-red-400" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-300">{translations.deleteAccount}</p>
                <p className="text-sm text-red-600 dark:text-red-400">Permanently delete your account</p>
              </div>
            </div>
            {showDeleteConfirm ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} className="dark:border-slate-600">Cancel</Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteAccount} disabled={loading} className="bg-red-600 hover:bg-red-700">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Delete"}
                </Button>
              </div>
            ) : (
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="bg-red-600 hover:bg-red-700">{translations.delete}</Button>
            )}
          </div>
          {showDeleteConfirm && <p className="mt-3 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded">{translations.deleteAccountWarning}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
