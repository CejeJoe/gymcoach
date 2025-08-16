import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { authStorage } from "@/lib/auth";
import { AuthResponse } from "@/lib/types";
import { Dumbbell, UserCheck, Users } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginPageProps {
  onLogin: (user: any) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm): Promise<AuthResponse> => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      authStorage.setToken(data.token);
      authStorage.setUser(data.user);
      onLogin(data.user);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.user.firstName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const onSubmit = (data: LoginForm) => {
    setIsLoading(true);
    loginMutation.mutate(data);
  };

  const fillDemoCredentials = (role: 'coach' | 'client') => {
    const credentials = {
      coach: { email: "coach@thrst.com", password: "coach123" },
      client: { email: "client@thrst.com", password: "client123" }
    };
    
    form.setValue("email", credentials[role].email);
    form.setValue("password", credentials[role].password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background with premium gym image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1200" 
          alt="Premium gym interior" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-sm space-y-8 animate-fade-in">
        {/* Logo & Branding */}
        <div className="text-center animate-slide-up">
          <div className="w-20 h-20 mx-auto mb-4 thrst-gradient rounded-2xl flex items-center justify-center animate-pulse-glow">
            <Dumbbell className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">THRST Coach</h1>
          <p className="text-gray-300 text-sm">Premium Fitness Management</p>
        </div>
        
        {/* Role Selection Cards */}
        <div className="space-y-4 animate-slide-up">
          <div className="gradient-border">
            <button 
              onClick={() => fillDemoCredentials('coach')}
              className="gradient-border-content w-full p-6 text-left transition-all duration-300 hover:scale-105"
              data-testid="button-coach-demo"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-thrst-green/20 rounded-xl flex items-center justify-center">
                  <UserCheck className="text-thrst-green h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Coach Login</h3>
                  <p className="text-sm text-muted-foreground">Manage clients and programs</p>
                </div>
              </div>
            </button>
          </div>
          
          <div className="gradient-border">
            <button 
              onClick={() => fillDemoCredentials('client')}
              className="gradient-border-content w-full p-6 text-left transition-all duration-300 hover:scale-105"
              data-testid="button-client-demo"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-thrst-accent/20 rounded-xl flex items-center justify-center">
                  <Users className="text-thrst-accent h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Client Login</h3>
                  <p className="text-sm text-muted-foreground">Track your progress</p>
                </div>
              </div>
            </button>
          </div>
        </div>
        
        {/* Login Form */}
        <Card className="glass-morphism border-white/20 animate-slide-up">
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                          className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full thrst-gradient hover:scale-105 transition-all duration-300 text-white border-0"
                  data-testid="button-login"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        {/* Demo Credentials */}
        <Card className="glass-morphism border-white/20 animate-slide-up">
          <CardContent className="p-4">
            <h4 className="text-white font-medium mb-2">Demo Credentials</h4>
            <p className="text-gray-300 text-xs leading-relaxed">
              Coach: coach@thrst.com / coach123<br />
              Client: client@thrst.com / client123
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
