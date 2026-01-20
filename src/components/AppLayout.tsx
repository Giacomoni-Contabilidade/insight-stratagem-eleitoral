import React, { useState } from 'react';
import { useCampaignStore } from '@/store/campaignStore';
import { DataImport } from '@/components/DataImport';
import { Dashboard } from '@/components/Dashboard';
import { GroupComparison } from '@/components/GroupComparison';
import { CandidacyProfile } from '@/components/CandidacyProfile';
import { AnalyticalGroups } from '@/components/AnalyticalGroups';
import { DatasetManager } from '@/components/DatasetManager';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  LayoutDashboard, 
  Upload, 
  Users, 
  User, 
  Layers,
  Database,
  Menu,
  X,
  BarChart3,
  ChevronDown
} from 'lucide-react';

type View = 'dashboard' | 'import' | 'comparison' | 'profile' | 'groups' | 'datasets';

interface NavItem {
  id: View;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'comparison', label: 'Comparação', icon: <Users className="w-4 h-4" /> },
  { id: 'profile', label: 'Perfil', icon: <User className="w-4 h-4" /> },
  { id: 'groups', label: 'Grupos', icon: <Layers className="w-4 h-4" /> },
  { id: 'datasets', label: 'Datasets', icon: <Database className="w-4 h-4" /> },
  { id: 'import', label: 'Importar', icon: <Upload className="w-4 h-4" /> },
];

const AppLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const datasets = useCampaignStore((s) => s.datasets);
  const activeDatasetId = useCampaignStore((s) => s.activeDatasetId);
  const setActiveDataset = useCampaignStore((s) => s.setActiveDataset);
  const viewMode = useCampaignStore((s) => s.viewMode);
  const setViewMode = useCampaignStore((s) => s.setViewMode);
  
  const activeDataset = datasets.find((d) => d.id === activeDatasetId);
  
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'import':
        return <DataImport onSuccess={() => setCurrentView('dashboard')} />;
      case 'comparison':
        return <GroupComparison />;
      case 'profile':
        return <CandidacyProfile />;
      case 'groups':
        return <AnalyticalGroups />;
      case 'datasets':
        return <DatasetManager />;
      default:
        return <Dashboard />;
    }
  };
  
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              <span className="font-bold text-lg">CampanhaAnalytics</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`sidebar-nav-item w-full ${
                currentView === item.id ? 'active' : ''
              } ${sidebarOpen ? '' : 'justify-center px-0'}`}
              title={!sidebarOpen ? item.label : undefined}
            >
              {item.icon}
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        
        {/* Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-sidebar-border">
            <p className="text-xs text-muted-foreground text-center">
              Análise Estratégica de Campanhas
            </p>
          </div>
        )}
      </aside>
      
      {/* Main Content */}
      <main 
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-16'
        }`}
      >
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {datasets.length > 0 && (
              <Select 
                value={activeDatasetId || ''} 
                onValueChange={(v) => setActiveDataset(v)}
              >
                <SelectTrigger className="w-64">
                  <Database className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Selecione um dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            {activeDataset && (
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <button
                  onClick={() => setViewMode('legal')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'legal' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Categorias Legais
                </button>
                <button
                  onClick={() => setViewMode('analytical')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'analytical' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Grupos Analíticos
                </button>
              </div>
            )}
          </div>
        </header>
        
        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
