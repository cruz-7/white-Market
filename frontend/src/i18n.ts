// Internationalization (i18n) support for White Market
// Provides translations for multiple languages and language switching functionality

export type Language = 'en' | 'tw' | 'ga' | 'fr' | 'es';

export interface TranslationKeys {
  // General
  appName: string;
  loading: string;
  save: string;
  cancel: string;
  confirm: string;
  delete: string;
  edit: string;
  search: string;
  close: string;
  back: string;
  next: string;
  done: string;
  error: string;
  success: string;
  warning: string;
  
  // Navigation
  home: string;
  categories: string;
  orders: string;
  messages: string;
  wallet: string;
  profile: string;
  settings: string;
  favorites: string;
  notificationsNav: string;
  
  // Auth
  login: string;
  logout: string;
  signUp: string;
  email: string;
  password: string;
  confirmPassword: string;
  forgotPassword: string;
  resetPassword: string;
  changePasswordNav: string;
  currentPassword: string;
  newPassword: string;
  
  // Settings
  editProfile: string;
  changePasswordTab: string;
  notificationsTab: string;
  privacy: string;
  theme: string;
  language: string;
  dangerZone: string;
  accountSettings: string;
  manageAccount: string;
  
  // Theme
  lightMode: string;
  darkMode: string;
  systemTheme: string;
  appearance: string;
  accentColor: string;
  
  // Notifications settings
  pushNotifications: string;
  emailAlerts: string;
  smsNotifications: string;
  orderUpdates: string;
  newMessages: string;
  promotions: string;
  referralUpdates: string;
  
  // Privacy
  profileVisibility: string;
  public: string;
  friendsOnly: string;
  private: string;
  showEmail: string;
  showPhone: string;
  dataSharing: string;
  
  // Danger zone
  exportData: string;
  deleteAccount: string;
  deleteAccountWarning: string;
  
  // Messages
  settingsSaved: string;
  settingsError: string;
  languageChanged: string;
  themeChanged: string;
  
  // Profile
  fullName: string;
  phone: string;
  campus: string;
  bio: string;
  avatar: string;
  
  // Products
  products: string;
  addProduct: string;
  productName: string;
  productPrice: string;
  productDescription: string;
  productCategory: string;
  productImage: string;
  
  // Orders
  myOrders: string;
  orderStatus: string;
  orderPending: string;
  orderProcessing: string;
  orderShipped: string;
  orderDelivered: string;
  orderCancelled: string;
  
  // Other
  learnMore: string;
  readMore: string;
  viewAll: string;
  seeAll: string;
  noResults: string;
  somethingWentWrong: string;
  tryAgain: string;
}

const translations: Record<Language, TranslationKeys> = {
  en: {
    // General
    appName: 'White Market',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    
    // Navigation
    home: 'Home',
    categories: 'Categories',
    orders: 'Orders',
    messages: 'Messages',
    wallet: 'Wallet',
    profile: 'Profile',
    settings: 'Settings',
    favorites: 'Favorites',
    notificationsNav: 'Notifications',
    
    // Auth
    login: 'Log In',
    logout: 'Log Out',
    signUp: 'Sign Up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    resetPassword: 'Reset Password',
    changePasswordNav: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    
    // Settings
    editProfile: 'Edit Profile',
    changePasswordTab: 'Change Password',
    notificationsTab: 'Notifications',
    privacy: 'Privacy',
    theme: 'Theme',
    language: 'Language',
    dangerZone: 'Danger Zone',
    accountSettings: 'Account Settings',
    manageAccount: 'Manage your account preferences',
    
    // Theme
    lightMode: 'Light',
    darkMode: 'Dark',
    systemTheme: 'System',
    appearance: 'Appearance',
    accentColor: 'Accent Color',
    
    // Notifications settings
    pushNotifications: 'Push Notifications',
    emailAlerts: 'Email Alerts',
    smsNotifications: 'SMS Notifications',
    orderUpdates: 'Order Updates',
    newMessages: 'New Messages',
    promotions: 'Promotions',
    referralUpdates: 'Referral Updates',
    
    // Privacy
    profileVisibility: 'Profile Visibility',
    public: 'Public',
    friendsOnly: 'Friends Only',
    private: 'Private',
    showEmail: 'Show Email',
    showPhone: 'Show Phone Number',
    dataSharing: 'Share Analytics Data',
    
    // Danger zone
    exportData: 'Export Your Data',
    deleteAccount: 'Delete Account',
    deleteAccountWarning: 'Warning: This cannot be undone.',
    
    // Messages
    settingsSaved: 'Settings saved successfully',
    settingsError: 'Failed to save settings',
    languageChanged: 'Language changed successfully',
    themeChanged: 'Theme changed successfully',
    
    // Profile
    fullName: 'Full Name',
    phone: 'Phone Number',
    campus: 'Campus',
    bio: 'Bio',
    avatar: 'Avatar',
    
    // Products
    products: 'Products',
    addProduct: 'Add Product',
    productName: 'Product Name',
    productPrice: 'Price',
    productDescription: 'Description',
    productCategory: 'Category',
    productImage: 'Image',
    
    // Orders
    myOrders: 'My Orders',
    orderStatus: 'Order Status',
    orderPending: 'Pending',
    orderProcessing: 'Processing',
    orderShipped: 'Shipped',
    orderDelivered: 'Delivered',
    orderCancelled: 'Cancelled',
    
    // Other
    learnMore: 'Learn More',
    readMore: 'Read More',
    viewAll: 'View All',
    seeAll: 'See All',
    noResults: 'No results found',
    somethingWentWrong: 'Something went wrong',
    tryAgain: 'Try Again',
  },
  
  tw: {
    // General
    appName: 'White Market',
    loading: ' loading...',
    save: ' сохранить',
    cancel: ' отмена',
    confirm: ' подтвердить',
    delete: ' удалить',
    edit: ' редактировать',
    search: ' искать',
    close: ' закрыть',
    back: ' назад',
    next: ' далее',
    done: ' готово',
    error: ' ошибка',
    success: ' успех',
    warning: ' предупреждение',
    
    // Navigation
    home: ' Главная',
    categories: 'Категории',
    orders: ' Заказы',
    messages: ' Сообщения',
    wallet: ' Кошелёк',
    profile: ' Профиль',
    settings: ' Настройки',
    favorites: ' Избранное',
    notificationsNav: ' Уведомления',
    
    // Auth
    login: ' Войти',
    logout: ' Выйти',
    signUp: ' Регистрация',
    email: ' Email',
    password: ' Пароль',
    confirmPassword: 'Подтвердите пароль',
    forgotPassword: 'Забыли пароль?',
    resetPassword: 'Сбросить пароль',
    changePasswordNav: 'Изменить пароль',
    currentPassword: 'Текущий пароль',
    newPassword: 'Новый пароль',
    
    // Settings
    editProfile: 'Редактировать профиль',
    changePasswordTab: 'Изменить пароль',
    notificationsTab: 'Уведомления',
    privacy: 'Конфиденциальность',
    theme: 'Тема',
    language: 'Язык',
    dangerZone: 'Опасная зона',
    accountSettings: 'Настройки аккаунта',
    manageAccount: 'Управление настройками аккаунта',
    
    // Theme
    lightMode: 'Светлая',
    darkMode: 'Тёмная',
    systemTheme: 'Системная',
    appearance: 'Внешний вид',
    accentColor: 'Акцентный цвет',
    
    // Notifications settings
    pushNotifications: 'Push-уведомления',
    emailAlerts: 'Email-уведомления',
    smsNotifications: 'SMS-уведомления',
    orderUpdates: 'Обновления заказов',
    newMessages: 'Новые сообщения',
    promotions: 'Акции',
    referralUpdates: 'Обновления рефералов',
    
    // Privacy
    profileVisibility: 'Видимость профиля',
    public: 'Публичный',
    friendsOnly: 'Только друзья',
    private: 'Приватный',
    showEmail: 'Показывать email',
    showPhone: 'Показывать телефон',
    dataSharing: 'Делиться аналитикой',
    
    // Danger zone
    exportData: 'Экспорт данных',
    deleteAccount: 'Удалить аккаунт',
    deleteAccountWarning: 'Внимание: Это нельзя отменить.',
    
    // Messages
    settingsSaved: 'Настройки сохранены',
    settingsError: 'Ошибка сохранения настроек',
    languageChanged: 'Язык изменён',
    themeChanged: 'Тема изменена',
    
    // Profile
    fullName: 'Полное имя',
    phone: 'Номер телефона',
    campus: 'Кампус',
    bio: 'О себе',
    avatar: 'Аватар',
    
    // Products
    products: 'Товары',
    addProduct: 'Добавить товар',
    productName: 'Название товара',
    productPrice: 'Цена',
    productDescription: 'Описание',
    productCategory: 'Категория',
    productImage: 'Изображение',
    
    // Orders
    myOrders: 'Мои заказы',
    orderStatus: 'Статус заказа',
    orderPending: 'Ожидание',
    orderProcessing: 'Обработка',
    orderShipped: 'Отправлен',
    orderDelivered: 'Доставлен',
    orderCancelled: 'Отменён',
    
    // Other
    learnMore: 'Узнать больше',
    readMore: 'Читать далее',
    viewAll: 'Показать все',
    seeAll: 'Все',
    noResults: 'Ничего не найдено',
    somethingWentWrong: 'Что-то пошло не так',
    tryAgain: 'Попробовать снова',
  },
  
  ga: {
    // General
    appName: 'White Market',
    loading: ' loading...',
    save: ' save',
    cancel: ' cancel',
    confirm: ' confirm',
    delete: ' delete',
    edit: ' edit',
    search: ' search',
    close: ' close',
    back: ' back',
    next: ' next',
    done: ' done',
    error: ' error',
    success: ' success',
    warning: ' warning',
    
    // Navigation
    home: ' Home',
    categories: 'Categories',
    orders: ' Orders',
    messages: ' Messages',
    wallet: ' Wallet',
    profile: ' Profile',
    settings: ' Settings',
    favorites: ' Favorites',
    notificationsNav: ' Notifications',
    
    // Auth
    login: ' Login',
    logout: ' Logout',
    signUp: ' Sign Up',
    email: ' Email',
    password: ' Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    resetPassword: 'Reset Password',
    changePasswordNav: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    
    // Settings
    editProfile: 'Edit Profile',
    changePasswordTab: 'Change Password',
    notificationsTab: 'Notifications',
    privacy: 'Privacy',
    theme: 'Theme',
    language: 'Language',
    dangerZone: 'Danger Zone',
    accountSettings: 'Account Settings',
    manageAccount: 'Manage your account',
    
    // Theme
    lightMode: 'Light',
    darkMode: 'Dark',
    systemTheme: 'System',
    appearance: 'Appearance',
    accentColor: 'Accent Color',
    
    // Notifications settings
    pushNotifications: 'Push Notifications',
    emailAlerts: 'Email Alerts',
    smsNotifications: 'SMS Notifications',
    orderUpdates: 'Order Updates',
    newMessages: 'New Messages',
    promotions: 'Promotions',
    referralUpdates: 'Referral Updates',
    
    // Privacy
    profileVisibility: 'Profile Visibility',
    public: 'Public',
    friendsOnly: 'Friends Only',
    private: 'Private',
    showEmail: 'Show Email',
    showPhone: 'Show Phone',
    dataSharing: 'Share Data',
    
    // Danger zone
    exportData: 'Export Data',
    deleteAccount: 'Delete Account',
    deleteAccountWarning: 'Warning: This cannot be undone.',
    
    // Messages
    settingsSaved: 'Settings saved',
    settingsError: 'Error saving settings',
    languageChanged: 'Language changed',
    themeChanged: 'Theme changed',
    
    // Profile
    fullName: 'Full Name',
    phone: 'Phone',
    campus: 'Campus',
    bio: 'Bio',
    avatar: 'Avatar',
    
    // Products
    products: 'Products',
    addProduct: 'Add Product',
    productName: 'Product Name',
    productPrice: 'Price',
    productDescription: 'Description',
    productCategory: 'Category',
    productImage: 'Image',
    
    // Orders
    myOrders: 'My Orders',
    orderStatus: 'Order Status',
    orderPending: 'Pending',
    orderProcessing: 'Processing',
    orderShipped: 'Shipped',
    orderDelivered: 'Delivered',
    orderCancelled: 'Cancelled',
    
    // Other
    learnMore: 'Learn More',
    readMore: 'Read More',
    viewAll: 'View All',
    seeAll: 'See All',
    noResults: 'No results',
    somethingWentWrong: 'Something went wrong',
    tryAgain: 'Try Again',
  },
  
  fr: {
    // General
    appName: 'White Market',
    loading: 'Chargement...',
    save: 'Enregistrer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    delete: 'Supprimer',
    edit: 'Modifier',
    search: 'Rechercher',
    close: 'Fermer',
    back: 'Retour',
    next: 'Suivant',
    done: 'Terminé',
    error: 'Erreur',
    success: 'Succès',
    warning: 'Attention',
    
    // Navigation
    home: 'Accueil',
    categories: 'Catégories',
    orders: 'Commandes',
    messages: 'Messages',
    wallet: 'Portefeuille',
    profile: 'Profil',
    settings: 'Paramètres',
    favorites: 'Favoris',
    notificationsNav: 'Notifications',
    
    // Auth
    login: 'Connexion',
    logout: 'Déconnexion',
    signUp: 'Inscription',
    email: 'Email',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    forgotPassword: 'Mot de passe oublié?',
    resetPassword: 'Réinitialiser le mot de passe',
    changePasswordNav: 'Changer le mot de passe',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    
    // Settings
    editProfile: 'Modifier le profil',
    changePasswordTab: 'Changer le mot de passe',
    notificationsTab: 'Notifications',
    privacy: 'Confidentialité',
    theme: 'Thème',
    language: 'Langue',
    dangerZone: 'Zone dangereuse',
    accountSettings: 'Paramètres du compte',
    manageAccount: 'Gérer les préférences de votre compte',
    
    // Theme
    lightMode: 'Clair',
    darkMode: 'Sombre',
    systemTheme: 'Système',
    appearance: 'Apparence',
    accentColor: 'Couleur d\'accent',
    
    // Notifications settings
    pushNotifications: 'Notifications push',
    emailAlerts: 'Alertes email',
    smsNotifications: 'Notifications SMS',
    orderUpdates: 'Mises à jour des commandes',
    newMessages: 'Nouveaux messages',
    promotions: 'Promotions',
    referralUpdates: 'Mises à jour des parrainages',
    
    // Privacy
    profileVisibility: 'Visibilité du profil',
    public: 'Public',
    friendsOnly: 'Amis uniquement',
    private: 'Privé',
    showEmail: 'Afficher l\'email',
    showPhone: 'Afficher le téléphone',
    dataSharing: 'Partager les données',
    
    // Danger zone
    exportData: 'Exporter vos données',
    deleteAccount: 'Supprimer le compte',
    deleteAccountWarning: 'Attention: Cette action est irréversible.',
    
    // Messages
    settingsSaved: 'Paramètres enregistrés',
    settingsError: 'Erreur lors de l\'enregistrement',
    languageChanged: 'Langue modifiée',
    themeChanged: 'Thème modifié',
    
    // Profile
    fullName: 'Nom complet',
    phone: 'Téléphone',
    campus: 'Campus',
    bio: 'Bio',
    avatar: 'Avatar',
    
    // Products
    products: 'Produits',
    addProduct: 'Ajouter un produit',
    productName: 'Nom du produit',
    productPrice: 'Prix',
    productDescription: 'Description',
    productCategory: 'Catégorie',
    productImage: 'Image',
    
    // Orders
    myOrders: 'Mes commandes',
    orderStatus: 'Statut de la commande',
    orderPending: 'En attente',
    orderProcessing: 'En cours',
    orderShipped: 'Expédié',
    orderDelivered: 'Livré',
    orderCancelled: 'Annulé',
    
    // Other
    learnMore: 'En savoir plus',
    readMore: 'Lire la suite',
    viewAll: 'Voir tout',
    seeAll: 'Voir tout',
    noResults: 'Aucun résultat',
    somethingWentWrong: 'Une erreur est survenue',
    tryAgain: 'Réessayer',
  },
  
  es: {
    // General
    appName: 'White Market',
    loading: 'Cargando...',
    save: 'Guardar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    delete: 'Eliminar',
    edit: 'Editar',
    search: 'Buscar',
    close: 'Cerrar',
    back: 'Atrás',
    next: 'Siguiente',
    done: 'Hecho',
    error: 'Error',
    success: 'Éxito',
    warning: 'Advertencia',
    
    // Navigation
    home: 'Inicio',
    categories: 'Categorías',
    orders: 'Pedidos',
    messages: 'Mensajes',
    wallet: 'Billetera',
    profile: 'Perfil',
    settings: 'Configuración',
    favorites: 'Favoritos',
    notificationsNav: 'Notificaciones',
    
    // Auth
    login: 'Iniciar sesión',
    logout: 'Cerrar sesión',
    signUp: 'Registrarse',
    email: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    resetPassword: 'Restablecer contraseña',
    changePasswordNav: 'Cambiar contraseña',
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña',
    
    // Settings
    editProfile: 'Editar perfil',
    changePasswordTab: 'Cambiar contraseña',
    notificationsTab: 'Notificaciones',
    privacy: 'Privacidad',
    theme: 'Tema',
    language: 'Idioma',
    dangerZone: 'Zona de peligro',
    accountSettings: 'Configuración de la cuenta',
    manageAccount: 'Administra las preferencias de tu cuenta',
    
    // Theme
    lightMode: 'Claro',
    darkMode: 'Oscuro',
    systemTheme: 'Sistema',
    appearance: 'Apariencia',
    accentColor: 'Color de acento',
    
    // Notifications settings
    pushNotifications: 'Notificaciones push',
    emailAlerts: 'Alertas de correo',
    smsNotifications: 'Notificaciones SMS',
    orderUpdates: 'Actualizaciones de pedidos',
    newMessages: 'Nuevos mensajes',
    promotions: 'Promociones',
    referralUpdates: 'Actualizaciones de referidos',
    
    // Privacy
    profileVisibility: 'Visibilidad del perfil',
    public: 'Público',
    friendsOnly: 'Solo amigos',
    private: 'Privado',
    showEmail: 'Mostrar correo',
    showPhone: 'Mostrar teléfono',
    dataSharing: 'Compartir datos',
    
    // Danger zone
    exportData: 'Exportar tus datos',
    deleteAccount: 'Eliminar cuenta',
    deleteAccountWarning: 'Advertencia: Esto no se puede deshacer.',
    
    // Messages
    settingsSaved: 'Configuración guardada',
    settingsError: 'Error al guardar',
    languageChanged: 'Idioma cambiado',
    themeChanged: 'Tema cambiado',
    
    // Profile
    fullName: 'Nombre completo',
    phone: 'Teléfono',
    campus: 'Campus',
    bio: 'Biografía',
    avatar: 'Avatar',
    
    // Products
    products: 'Productos',
    addProduct: 'Agregar producto',
    productName: 'Nombre del producto',
    productPrice: 'Precio',
    productDescription: 'Descripción',
    productCategory: 'Categoría',
    productImage: 'Imagen',
    
    // Orders
    myOrders: 'Mis pedidos',
    orderStatus: 'Estado del pedido',
    orderPending: 'Pendiente',
    orderProcessing: 'Procesando',
    orderShipped: 'Enviado',
    orderDelivered: 'Entregado',
    orderCancelled: 'Cancelado',
    
    // Other
    learnMore: 'Más información',
    readMore: 'Leer más',
    viewAll: 'Ver todo',
    seeAll: 'Ver todo',
    noResults: 'Sin resultados',
    somethingWentWrong: 'Algo salió mal',
    tryAgain: 'Intentar de nuevo',
  },
};

export const getTranslations = (lang: Language): TranslationKeys => {
  return translations[lang] || translations.en;
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  tw: 'Twi',
  ga: 'Ga',
  fr: 'Français',
  es: 'Español',
};

export const languageFlags: Record<Language, string> = {
  en: '🇬🇭',
  tw: '🇬🇭',
  ga: '🇬🇭',
  fr: '🇫🇷',
  es: '🇪🇸',
};

export default translations;
