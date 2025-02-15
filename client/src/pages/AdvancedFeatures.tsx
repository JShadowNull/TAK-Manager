import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shared/ui/shadcn/tabs";
import { useTakServerRequired } from '../components/shared/hooks/useTakServerRequired';
import TakServerRequiredDialog from '../components/shared/TakServerRequiredDialog';
import CoreConfigEditor from '../components/advancedfeatures/CoreConfigEditor';
import BackupManager from '../components/advancedfeatures/BackupManager';
import LogViewer from '../components/advancedfeatures/LogViewer';

const AdvancedFeatures: React.FC = () => {
  // TAK Server check
  const { showDialog, dialogProps, isServerRunning } = useTakServerRequired({
    title: "TAK Server Required for Advanced Features",
    description: "Advanced features require TAK Server to be running. Would you like to start it now?",
  });

  const [currentTab, setCurrentTab] = useState(() => {
    return sessionStorage.getItem('advancedFeaturesTab') || 'core-config';
  });

  // Effect to store current tab in sessionStorage
  useEffect(() => {
    sessionStorage.setItem('advancedFeaturesTab', currentTab);
  }, [currentTab]);

  // Show dialog immediately if server is not running
  useEffect(() => {
    if (!isServerRunning) {
      showDialog(true);
    }
  }, [isServerRunning, showDialog]);

  const renderContent = () => (
    <div className={`bg-background text-foreground pt-4 ${!isServerRunning ? 'pointer-events-none opacity-50' : ''}`}>
      <div className="mx-auto space-y-8">
        <Tabs defaultValue={currentTab} onValueChange={setCurrentTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-muted">
              <TabsTrigger 
                value="core-config" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Core Config
              </TabsTrigger>
              <TabsTrigger 
                value="backups" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Backup Manager
              </TabsTrigger>
              <TabsTrigger 
                value="logs" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:rounded-lg"
              >
                Logs
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="w-full">
            <TabsContent value="core-config" className="w-full">
              <div className="bg-card rounded-lg">
                <CoreConfigEditor />
              </div>
            </TabsContent>
            <TabsContent value="backups" className="w-full">
              <div className="bg-card rounded-lg">
                <BackupManager />
              </div>
            </TabsContent>
            <TabsContent value="logs" className="w-full">
              <div className="bg-card rounded-lg">
                <LogViewer />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );

  return (
    <>
      {renderContent()}
      <TakServerRequiredDialog {...dialogProps} />
    </>
  );
};

export default AdvancedFeatures; 