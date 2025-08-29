import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleLearnMore = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/10 to-accent/10">
      <div className="text-center space-y-6 p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-xl">
            <span className="text-primary-foreground font-bold text-2xl">C</span>
          </div>
        </div>
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          Welcome to ChampTime
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          A comprehensive Human Resource Management system designed to streamline your workforce operations with modern design and powerful features.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Button 
            onClick={handleGetStarted}
            className="px-8 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            Get Started
          </Button>
          <Button 
            variant="outline"
            onClick={handleLearnMore}
            className="px-8 py-3 border-2 border-primary text-primary rounded-lg font-semibold hover:bg-primary/10 transition-all duration-200"
          >
            Learn More
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
