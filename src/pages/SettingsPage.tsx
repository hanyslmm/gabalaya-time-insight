
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WageSettings from '@/components/WageSettings';
import RoleManagement from '@/components/RoleManagement';

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
                <p className="text-sm text-gray-600">2.0.5</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <RoleManagement />
      </div>
    </div>
  );
};

export default SettingsPage;
