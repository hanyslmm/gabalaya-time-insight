
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      dashboard: 'Dashboard',
      employees: 'Employees',
      timesheets: 'Timesheets',
      settings: 'Settings',
      logout: 'Logout',
      reports: 'Reports',
      
      // Authentication
      login: 'Login',
      username: 'Username',
      password: 'Password',
      welcomeBack: 'Welcome Back',
      loginSubtitle: 'Sign in to access the Gabalaya Finance HRM System',
      
      // Dashboard
      overview: 'Overview',
      totalHours: 'Total Hours',
      totalPayroll: 'Total Payroll',
      totalEmployees: 'Total Employees',
      recentActivity: 'Recent Activity',
      
      // Employees
      addEmployee: 'Add Employee',
      editEmployee: 'Edit Employee',
      deleteEmployee: 'Delete Employee',
      staffId: 'Staff ID',
      fullName: 'Full Name',
      role: 'Role',
      hiringDate: 'Hiring Date',
      email: 'Email',
      phoneNumber: 'Phone Number',
      
      // Timesheets
      uploadTimesheet: 'Upload Timesheet',
      exportTimesheet: 'Export Timesheet',
      splitWages: 'Split Selected Wages',
      deleteSelected: 'Delete Selected',
      analyzeShift: 'Analyze Shift',
      generateSummary: 'Generate Summary',
      
      // Common
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      view: 'View',
      search: 'Search',
      filter: 'Filter',
      actions: 'Actions',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
      confirmation: 'Confirmation',
      
      // Messages
      loginSuccess: 'Login successful!',
      loginError: 'Invalid username or password',
      employeeAdded: 'Employee added successfully',
      employeeUpdated: 'Employee updated successfully',
      employeeDeleted: 'Employee deleted successfully',
      timesheetUploaded: 'Timesheet uploaded successfully',
      
      // Wage Settings
      wageSettings: 'Wage Settings',
      morningHours: 'Morning Hours',
      nightHours: 'Night Hours',
      morningRate: 'Morning Rate (LE/hr)',
      nightRate: 'Night Rate (LE/hr)',
      flatRate: 'Flat Rate (LE/hr)',
    }
  },
  ar: {
    translation: {
      // Navigation
      dashboard: 'لوحة التحكم',
      employees: 'الموظفين',
      timesheets: 'جداول العمل',
      settings: 'الإعدادات',
      logout: 'تسجيل الخروج',
      reports: 'التقارير',
      
      // Authentication
      login: 'تسجيل الدخول',
      username: 'اسم المستخدم',
      password: 'كلمة المرور',
      welcomeBack: 'مرحباً بعودتك',
      loginSubtitle: 'سجل دخولك للوصول إلى نظام إدارة الموارد البشرية',
      
      // Dashboard
      overview: 'نظرة عامة',
      totalHours: 'إجمالي الساعات',
      totalPayroll: 'إجمالي الرواتب',
      totalEmployees: 'إجمالي الموظفين',
      recentActivity: 'النشاط الأخير',
      
      // Employees
      addEmployee: 'إضافة موظف',
      editEmployee: 'تعديل الموظف',
      deleteEmployee: 'حذف الموظف',
      staffId: 'رقم الموظف',
      fullName: 'الاسم الكامل',
      role: 'الوظيفة',
      hiringDate: 'تاريخ التوظيف',
      email: 'البريد الإلكتروني',
      phoneNumber: 'رقم الهاتف',
      
      // Timesheets
      uploadTimesheet: 'رفع جدول العمل',
      exportTimesheet: 'تصدير جدول العمل',
      splitWages: 'تقسيم الأجور المحددة',
      deleteSelected: 'حذف المحدد',
      analyzeShift: 'تحليل الوردية',
      generateSummary: 'إنشاء ملخص',
      
      // Common
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      view: 'عرض',
      search: 'بحث',
      filter: 'تصفية',
      actions: 'الإجراءات',
      loading: 'جاري التحميل...',
      success: 'نجح',
      error: 'خطأ',
      confirmation: 'تأكيد',
      
      // Messages
      loginSuccess: 'تم تسجيل الدخول بنجاح!',
      loginError: 'اسم المستخدم أو كلمة المرور غير صحيحة',
      employeeAdded: 'تم إضافة الموظف بنجاح',
      employeeUpdated: 'تم تحديث الموظف بنجاح',
      employeeDeleted: 'تم حذف الموظف بنجاح',
      timesheetUploaded: 'تم رفع جدول العمل بنجاح',
      
      // Wage Settings
      wageSettings: 'إعدادات الأجور',
      morningHours: 'ساعات الصباح',
      nightHours: 'ساعات الليل',
      morningRate: 'معدل الصباح (جنيه/ساعة)',
      nightRate: 'معدل الليل (جنيه/ساعة)',
      flatRate: 'المعدل الثابت (جنيه/ساعة)',
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
