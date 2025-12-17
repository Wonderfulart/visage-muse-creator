import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut, User } from 'lucide-react';

export const AuthButton = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/profile')}
          className="text-muted-foreground hover:text-foreground"
        >
          <User className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={() => navigate('/auth')}
    >
      <LogIn className="w-4 h-4 sm:mr-1" />
      <span className="hidden sm:inline">Sign In</span>
    </Button>
  );
};
