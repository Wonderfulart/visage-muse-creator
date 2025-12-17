import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Mail, Calendar, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { supabase } from '@/integrations/supabase/client';

const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Profile = () => {
  const { user, loading, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const validatePasswordForm = () => {
    const newErrors: { password?: string; confirmPassword?: string } = {};
    
    const passwordResult = passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) return;
    
    setPasswordLoading(true);
    
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully!');
        setNewPassword('');
        setConfirmPassword('');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    
    try {
      // Delete user's videos from database (storage will be orphaned but that's ok)
      const { error: deleteError } = await supabase
        .from('videos')
        .delete()
        .eq('user_id', user?.id);
      
      if (deleteError) {
        console.error('Error deleting videos:', deleteError);
      }

      // Sign out first
      await signOut();
      
      toast.success('Account data deleted. You have been signed out.');
      navigate('/auth');
    } catch (err) {
      console.error('Error deleting account:', err);
      toast.error('Failed to delete account data');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Studio</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Page Title */}
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">Profile Settings</h1>
            <p className="text-muted-foreground mt-2">Manage your account settings and preferences</p>
          </div>

          {/* Account Info */}
          <div className="card-elevated rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-foreground">Account Information</h2>
                <p className="text-sm text-muted-foreground">Your basic account details</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-foreground font-medium">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Account Created</p>
                  <p className="text-foreground font-medium">{formatDate(user.created_at)}</p>
                </div>
              </div>

              {user.app_metadata?.provider && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Sign-in Method</p>
                    <p className="text-foreground font-medium capitalize">{user.app_metadata.provider}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Change Password */}
          {user.app_metadata?.provider === 'email' && (
            <div className="card-elevated rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-heading font-semibold text-foreground">Change Password</h2>
                  <p className="text-sm text-muted-foreground">Update your account password</p>
                </div>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={passwordLoading || !newPassword || !confirmPassword}
                  className="w-full sm:w-auto"
                >
                  {passwordLoading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Danger Zone */}
          <div className="card-elevated rounded-2xl p-6 space-y-6 border-destructive/20">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-destructive/10">
                <Trash2 className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-foreground">Danger Zone</h2>
                <p className="text-sm text-muted-foreground">Irreversible actions</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5">
              <h3 className="font-medium text-foreground mb-2">Delete Account Data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete all your videos and sign you out. This action cannot be undone.
              </p>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleteLoading}>
                    {deleteLoading ? (
                      <div className="w-5 h-5 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account Data
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your videos and sign you out. 
                      You can create a new account with the same email later, but your videos will be gone forever.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, delete everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
