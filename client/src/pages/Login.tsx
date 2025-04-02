import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/utils/AuthContext';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormItem, FormLabel, FormControl, FormMessage, FormField } from '../components/shared/ui/shadcn/form';
import { Button } from '../components/shared/ui/shadcn/button';
import { Card, CardHeader, CardTitle } from '../components/shared/ui/shadcn/card/card';
import { Input } from '../components/shared/ui/shadcn/input';
import { Eye, EyeOff } from 'lucide-react';

// Define the form schema with zod
const loginSchema = z.object({
  username: z.string().min(8, 'Username must be at least 8 characters long'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

// Type for the form values derived from the schema
type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSignup, setNeedsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Initialize form with react-hook-form and zod resolver
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  useEffect(() => {
    // If already authenticated, redirect to home
    if (isAuthenticated) {
      navigate('/');
    }
    
    const checkUserExists = async () => {
      try {
        const response = await axios.get('/api/auth/check-user-exists');
        setNeedsSignup(!response.data.exists);
      } catch (err) {
        console.error('Error checking if user exists:', err);
      }
    };

    checkUserExists();
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setError('');

    try {
      if (needsSignup) {
        // Handle signup
        const response = await axios.post('/api/auth/signup', {
          username: data.username,
          password: data.password,
        });

        const { access_token, refresh_token } = response.data;
        await login(access_token, refresh_token);
        console.log('Signup successful, redirecting to home page');
      } else {
        // Handle login
        const formData = new URLSearchParams();
        formData.append('username', data.username);
        formData.append('password', data.password);

        const response = await axios.post('/api/auth/token', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        const { access_token, refresh_token } = response.data;
        await login(access_token, refresh_token);
        console.log('Login successful, redirecting to home page');
      }
      
      // Force navigation to home with timeout to allow state updates
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 100);
    } catch (err: any) {
      console.error(needsSignup ? 'Signup error:' : 'Login error:', err);
      setError(err.response?.data?.detail || (needsSignup ? 'Signup failed. Please try again.' : 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md p-8 flex flex-col border border-border">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-center text-xl font-bold">
            {needsSignup ? 'Create Admin Account' : 'Log In to TAK Manager'}
          </CardTitle>
          <p className="text-muted-foreground text-sm text-center">
            {needsSignup
              ? 'Set up your administrator account'
              : 'Enter your credentials to access the platform'}
          </p>
        </CardHeader>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500 text-red-500 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Username Field */}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1">
                  <FormLabel className="text-sm font-semibold text-primary flex flex-row items-center gap-1">
                    Username {form.formState.errors.username && <span className="text-red-500">*</span>}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Enter your username"
                      className={`w-full ${form.formState.errors.username ? 'border-red-500' : ''}`}
                      required
                    />
                  </FormControl>
                  <FormMessage className="text-sm text-red-500" />
                </FormItem>
              )}
            />

            {/* Password Field */}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-1">
                  <FormLabel className="text-sm font-semibold text-primary flex flex-row items-center gap-1">
                    Password {form.formState.errors.password && <span className="text-red-500">*</span>}
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input 
                        {...field} 
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className={`w-full ${form.formState.errors.password ? 'border-red-500' : ''}`}
                        required
                      />
                    </FormControl>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="bg-transparent hover:bg-transparent text-muted-foreground hover:text-primary h-6 w-6 p-0"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </div>
                  <FormMessage className="text-sm text-red-500" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              variant="primary"
            >
              {needsSignup ? 'Create Account' : 'Log In'}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
};

export default Login; 