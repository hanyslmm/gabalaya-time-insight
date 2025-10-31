
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WageSettings from '@/components/WageSettings';
import RoleManagement from '@/components/RoleManagement';
import PayPeriodSettings from '@/components/PayPeriodSettings';

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('settings')}</h1>
        <p className="mt-2 text-sm text-gray-600">Configure system settings and parameters</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('wageSettings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <WageSettings />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Version</h4>
                <p className="text-sm text-gray-600">2.5.1</p>
              </div>
              <div>
                <h4 className="font-medium">Recent Updates</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    <span>Fixed timezone inconsistency in working duration calculations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    <span>Added real-time virtual hours for active employees</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    <span>Consistent working time display across all UI sections</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    <span>Enhanced hour calculation accuracy and reliability</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <PayPeriodSettings />
      </div>

      <div className="mt-6">
        <RoleManagement />
      </div>
    </div>
  );
};

export default SettingsPage;
