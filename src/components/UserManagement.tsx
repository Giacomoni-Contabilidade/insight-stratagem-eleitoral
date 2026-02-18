import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { UserPlus, Key, Shield, Database, Trash2, Loader2, Users } from 'lucide-react';

interface Profile {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface DatasetAccess {
  user_id: string;
  dataset_id: string;
}

const callAdminApi = async (action: string, params: Record<string, unknown> = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(`https://${projectId}.supabase.co/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
};

export const UserManagement: React.FC = () => {
  const { datasets, user } = useData();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [access, setAccess] = useState<DatasetAccess[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Dataset access dialog
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessUserId, setAccessUserId] = useState('');
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await callAdminApi('list-users');
      setProfiles(data.profiles);
      setRoles(data.roles);
      setAccess(data.access);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const getUserRole = (userId: string) => roles.find(r => r.user_id === userId)?.role || 'user';
  const getUserDatasets = (userId: string) => access.filter(a => a.user_id === userId).map(a => a.dataset_id);

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword) { toast.error('Email e senha são obrigatórios'); return; }
    if (newPassword.length < 6) { toast.error('Senha deve ter no mínimo 6 caracteres'); return; }
    try {
      setCreating(true);
      await callAdminApi('create-user', { email: newEmail, password: newPassword, displayName: newDisplayName, isAdmin: newIsAdmin });
      toast.success('Usuário criado com sucesso');
      setCreateOpen(false);
      setNewEmail(''); setNewPassword(''); setNewDisplayName(''); setNewIsAdmin(false);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 6) { toast.error('Senha deve ter no mínimo 6 caracteres'); return; }
    try {
      setResetting(true);
      await callAdminApi('reset-password', { userId: resetUserId, newPassword: resetPassword });
      toast.success('Senha redefinida');
      setResetOpen(false); setResetPassword('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await callAdminApi('set-role', { userId, role: newRole });
      toast.success(`Papel alterado para ${newRole}`);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveAccess = async () => {
    try {
      setSavingAccess(true);
      await callAdminApi('set-dataset-access', { userId: accessUserId, datasetIds: selectedDatasets });
      toast.success('Acesso atualizado');
      setAccessOpen(false);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingAccess(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await callAdminApi('delete-user', { userId });
      toast.success('Usuário removido');
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openAccessDialog = (userId: string) => {
    setAccessUserId(userId);
    setSelectedDatasets(getUserDatasets(userId));
    setAccessOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" />
            Gerenciamento de Usuários
          </h2>
          <p className="text-muted-foreground mt-1">Cadastrar, editar permissões e controlar acesso a datasets</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Nome de Exibição</Label>
                <Input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="Nome do usuário" />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="newIsAdmin" checked={newIsAdmin} onCheckedChange={v => setNewIsAdmin(!!v)} />
                <Label htmlFor="newIsAdmin">Administrador</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateUser} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {profiles.map(profile => {
          const role = getUserRole(profile.user_id);
          const userDatasets = getUserDatasets(profile.user_id);
          const isSelf = profile.user_id === user?.id;

          return (
            <Card key={profile.user_id}>
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {(profile.display_name || profile.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{profile.display_name || profile.email}</span>
                      <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
                        {role === 'admin' ? 'Admin' : 'Usuário'}
                      </Badge>
                      {isSelf && <Badge variant="outline">Você</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{profile.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {role === 'admin' ? 'Acesso total' : `${userDatasets.length} dataset(s) acessível(is)`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleToggleRole(profile.user_id, role)}
                    disabled={isSelf}
                    title={isSelf ? 'Não pode alterar seu próprio papel' : undefined}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {role === 'admin' ? 'Tornar Usuário' : 'Tornar Admin'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => { setResetUserId(profile.user_id); setResetOpen(true); }}
                  >
                    <Key className="w-3.5 h-3.5" />
                    Redefinir Senha
                  </Button>

                  {role !== 'admin' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => openAccessDialog(profile.user_id)}
                    >
                      <Database className="w-3.5 h-3.5" />
                      Datasets
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={isSelf}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Essa ação é irreversível. O usuário {profile.email} será removido permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteUser(profile.user_id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleResetPassword} disabled={resetting}>
              {resetting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dataset Access Dialog */}
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Acesso a Datasets</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {datasets.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum dataset cadastrado</p>
            ) : (
              datasets.map(ds => (
                <div key={ds.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <Checkbox
                    id={`ds-${ds.id}`}
                    checked={selectedDatasets.includes(ds.id)}
                    onCheckedChange={(checked) => {
                      setSelectedDatasets(prev =>
                        checked ? [...prev, ds.id] : prev.filter(id => id !== ds.id)
                      );
                    }}
                  />
                  <Label htmlFor={`ds-${ds.id}`} className="flex-1 cursor-pointer">
                    <span className="font-medium">{ds.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({ds.candidacies?.length || 0} candidaturas)
                    </span>
                  </Label>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveAccess} disabled={savingAccess}>
              {savingAccess && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
