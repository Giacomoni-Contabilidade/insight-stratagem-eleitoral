import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { DataImport } from '@/components/DataImport';
import { Dashboard } from '@/components/Dashboard';
import { GroupComparison } from '@/components/GroupComparison';
import { CandidacyProfile } from '@/components/CandidacyProfile';
import { CandidacyComparison } from '@/components/CandidacyComparison';
import { AnalyticalGroups } from '@/components/AnalyticalGroups';
import { DatasetManager } from '@/components/DatasetManager';
import { TopTenView } from '@/components/TopTenView';
import { ReportGenerator } from '@/components/reports';
import { UserManagement } from '@/components/UserManagement';
import { DatasetComparison } from '@/components/DatasetComparison';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  LayoutDashboard, 
  Upload, 
  Users, 
  User, 
  Layers,
  Database,
  BarChart3,
  GitCompareArrows,
  Trophy,
  ChevronLeft,
  ChevronRight,
  FileDown,
  LogOut,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

type View = 'dashboard' | 'import' | 'comparison' | 'profile' | 'groups' | 'datasets' | 'candidacy-comparison' | 'top-ten' | 'reports' | 'dataset-comparison' | 'users';

interface NavItem {
  id: View;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const getNavSections = (isAdmin: boolean): NavSection[] => [
  {
    title: 'Análise',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, description: 'Visão geral' },
      { id: 'top-ten', label: '10+', icon: <Trophy className="w-5 h-5" />, description: 'Rankings' },
      { id: 'comparison', label: 'Grupos', icon: <Users className="w-5 h-5" />, description: 'Comparações' },
      { id: 'candidacy-comparison', label: 'Comparar', icon: <GitCompareArrows className="w-5 h-5" />, description: 'Candidaturas' },
      { id: 'profile', label: 'Perfil', icon: <User className="w-5 h-5" />, description: 'Individual' },
      { id: 'dataset-comparison', label: 'Datasets', icon: <Database className="w-5 h-5" />, description: 'Comparar datasets' },
      { id: 'reports', label: 'Relatórios', icon: <FileDown className="w-5 h-5" />, description: 'Exportar PDF' },
    ],
  },
  {
    title: 'Configuração',
    items: [
      { id: 'groups', label: 'Config. Grupos', icon: <Layers className="w-5 h-5" />, description: 'Categorias' },
      { id: 'datasets', label: 'Datasets', icon: <Database className="w-5 h-5" />, description: 'Gerenciar' },
      { id: 'import', label: 'Importar', icon: <Upload className="w-5 h-5" />, description: 'Novos dados' },
      ...(isAdmin ? [{ id: 'users' as View, label: 'Usuários', icon: <Users className="w-5 h-5" />, description: 'Gerenciar contas' }] : []),
    ],
  },
];

const AppLayout = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const {
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    viewMode,
    setViewMode,
    signOut,
    dataLoading,
    user,
    isAdmin,
    getActiveDataset,
  } = useData();
  
  const activeDataset = getActiveDataset();
  const navSections = getNavSections(isAdmin);
  
  const renderContent = () => {
    if (dataLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'import':
        return <DataImport onSuccess={() => setCurrentView('dashboard')} />;
      case 'comparison':
        return <GroupComparison />;
      case 'candidacy-comparison':
        return <CandidacyComparison />;
      case 'top-ten':
        return <TopTenView />;
      case 'profile':
        return <CandidacyProfile />;
      case 'groups':
        return <AnalyticalGroups />;
      case 'datasets':
        return <DatasetManager />;
      case 'dataset-comparison':
        return <DatasetComparison />;
      case 'reports':
        return <ReportGenerator />;
      case 'users':
        return <UserManagement />;
      default:
        return <Dashboard />;
    }
  };
  
  return (
    <div ref={ref} className="min-h-screen flex bg-background" {...props}>
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border shadow-card transition-all duration-300 ease-in-out",
          sidebarOpen ? 'w-72' : 'w-20'
        )}
      >
        {/* Logo Header */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-border">
          <div className={cn(
            "flex items-center gap-3 transition-all duration-300",
            !sidebarOpen && "justify-center"
          )}>
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <div className="animate-fade-in">
                <h1 className="font-bold text-lg tracking-tight text-foreground">Campanha</h1>
                <p className="text-xs text-muted-foreground -mt-0.5">Analytics</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-6 overflow-y-auto scrollbar-thin">
          {navSections.map((section, idx) => (
            <div key={section.title}>
              {sidebarOpen && (
                <h3 className="px-3 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </h3>
              )}
              {!sidebarOpen && idx > 0 && (
                <Separator className="mb-4" />
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl transition-all duration-200 group relative",
                      sidebarOpen ? "px-4 py-3" : "px-0 py-3 justify-center",
                      currentView === item.id 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <span className={cn(
                      "transition-transform duration-200",
                      currentView !== item.id && "group-hover:scale-110"
                    )}>
                      {item.icon}
                    </span>
                    {sidebarOpen && (
                      <div className="flex flex-col items-start animate-fade-in">
                        <span className="font-medium text-sm">{item.label}</span>
                        {item.description && (
                          <span className={cn(
                            "text-xs",
                            currentView === item.id 
                              ? "text-primary-foreground/70" 
                              : "text-muted-foreground"
                          )}>
                            {item.description}
                          </span>
                        )}
                      </div>
                    )}
                    {currentView === item.id && sidebarOpen && (
                      <div className="absolute right-3 w-1.5 h-6 bg-primary-foreground/30 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        
        {/* Collapse Button */}
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "w-full justify-center gap-2 text-muted-foreground hover:text-foreground",
              sidebarOpen && "justify-start px-4"
            )}
          >
            {sidebarOpen ? (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm">Recolher</span>
              </>
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* User & Logout */}
        {sidebarOpen && (
          <div className="px-5 pb-5 space-y-3">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground text-center truncate mb-2">
                {user?.email}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="w-full gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </div>
          </div>
        )}
      </aside>
      
      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 flex flex-col transition-all duration-300 ease-in-out min-h-screen",
          sidebarOpen ? 'ml-72' : 'ml-20'
        )}
      >
        {/* Top Bar */}
        <header className="h-20 flex items-center justify-between px-8 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-6">
            {datasets.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Database className="w-4 h-4" />
                  <span className="font-medium">Dataset:</span>
                </div>
                <Select 
                  value={activeDatasetId || ''} 
                  onValueChange={(v) => setActiveDatasetId(v)}
                >
                  <SelectTrigger className="w-72 h-11 bg-background border-border/50 shadow-sm">
                    <SelectValue placeholder="Selecione um dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    {datasets.map((ds) => (
                      <SelectItem key={ds.id} value={ds.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{ds.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {ds.candidacyCount} candidaturas
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            {activeDataset && (
              <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1.5 shadow-inner">
                <button
                  onClick={() => setViewMode('legal')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    viewMode === 'legal' 
                      ? 'bg-card text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Categorias Legais
                </button>
                <button
                  onClick={() => setViewMode('analytical')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    viewMode === 'analytical' 
                      ? 'bg-card text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Grupos Analíticos
                </button>
              </div>
            )}
          </div>
        </header>
        
        {/* Content */}
        <div className="flex-1 p-8 overflow-auto bg-background">
          <div className="animate-fade-in">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
});

AppLayout.displayName = "AppLayout";

export default AppLayout;
