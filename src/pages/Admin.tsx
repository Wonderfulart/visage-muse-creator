import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Shield, Users, Crown, UserCheck, UserX, ArrowLeft, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useAdmin, AppRole } from '@/hooks/useAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  moderator: 'bg-primary text-primary-foreground',
  user: 'bg-secondary text-secondary-foreground'
};

const ROLE_ICONS: Record<AppRole, typeof Crown> = {
  admin: Crown,
  moderator: Shield,
  user: UserCheck
};

const Admin = () => {
  const { user } = useAuth();
  const { 
    isAdmin, 
    loading, 
    users, 
    fetchUsers, 
    fetchUserRoles,
    addUserRole, 
    removeUserRole, 
    getUserRoles 
  } = useAdmin();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('user');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/app" replace />;
  }

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddRole = async (userId: string) => {
    setActionLoading(`add-${userId}`);
    const result = await addUserRole(userId, selectedRole);
    setActionLoading(null);
    
    if (result.success) {
      toast.success(`Added ${selectedRole} role`);
    } else {
      toast.error(result.error || 'Failed to add role');
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    if (userId === user?.id && role === 'admin') {
      toast.error("You cannot remove your own admin role");
      return;
    }

    setActionLoading(`remove-${userId}-${role}`);
    const result = await removeUserRole(userId, role);
    setActionLoading(null);
    
    if (result.success) {
      toast.success(`Removed ${role} role`);
    } else {
      toast.error(result.error || 'Failed to remove role');
    }
  };

  const handleRefresh = async () => {
    setActionLoading('refresh');
    await Promise.all([fetchUsers(), fetchUserRoles()]);
    setActionLoading(null);
    toast.success('Data refreshed');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/app">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Shield className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h1 className="font-heading text-xl font-bold">Admin Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Manage user roles and permissions</p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={actionLoading === 'refresh'}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${actionLoading === 'refresh' ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card-elevated rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </div>
          <div className="card-elevated rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-destructive/10">
                <Crown className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => getUserRoles(u.id).includes('admin')).length}
                </p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </div>
          <div className="card-elevated rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-secondary/50">
                <Shield className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => getUserRoles(u.id).includes('moderator')).length}
                </p>
                <p className="text-sm text-muted-foreground">Moderators</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="card-elevated rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Users Table */}
        <div className="card-elevated rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Videos</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No users found matching your search' : 'No users found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const roles = getUserRoles(u.id);
                  const isCurrentUser = u.id === user?.id;
                  
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.email || 'No email'}</p>
                          <p className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}...</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {u.subscription_tier || 'free'}
                        </Badge>
                      </TableCell>
                      <TableCell>{u.videos_generated_this_month || 0}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No roles</span>
                          ) : (
                            roles.map((role) => {
                              const Icon = ROLE_ICONS[role];
                              return (
                                <Badge 
                                  key={role} 
                                  className={`${ROLE_COLORS[role]} gap-1 capitalize`}
                                >
                                  <Icon className="w-3 h-3" />
                                  {role}
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Add Role */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={roles.includes(selectedRole)}
                              >
                                <UserCheck className="w-4 h-4 mr-1" />
                                Add
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Add Role</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to add the <strong>{selectedRole}</strong> role to{' '}
                                  <strong>{u.email}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleAddRole(u.id)}
                                  disabled={actionLoading === `add-${u.id}`}
                                >
                                  {actionLoading === `add-${u.id}` ? 'Adding...' : 'Add Role'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          {/* Remove Role */}
                          {roles.length > 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <UserX className="w-4 h-4 mr-1" />
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Role</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Select a role to remove from <strong>{u.email}</strong>:
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="flex flex-wrap gap-2 py-4">
                                  {roles.map((role) => (
                                    <Button
                                      key={role}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRemoveRole(u.id, role)}
                                      disabled={
                                        actionLoading === `remove-${u.id}-${role}` ||
                                        (isCurrentUser && role === 'admin')
                                      }
                                      className={`capitalize ${
                                        isCurrentUser && role === 'admin' 
                                          ? 'opacity-50 cursor-not-allowed' 
                                          : 'hover:bg-destructive hover:text-destructive-foreground'
                                      }`}
                                    >
                                      {actionLoading === `remove-${u.id}-${role}` ? 'Removing...' : `Remove ${role}`}
                                    </Button>
                                  ))}
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default Admin;
