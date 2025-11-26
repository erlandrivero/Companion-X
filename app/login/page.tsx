import { LoginButton } from "@/components/LoginButton";
import { Brain, Sparkles, Zap, Shield } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-50 rounded-full"></div>
              <Brain className="w-16 h-16 text-purple-400 relative" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Companion X</h1>
          <p className="text-purple-300 text-lg">AI Agent Profile Manager</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-white mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-300">
              Sign in to manage your AI agent profiles
            </p>
          </div>

          <LoginButton />

          {/* Features */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-gray-300">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="text-sm">Create specialized AI agents</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Zap className="w-5 h-5 text-purple-400" />
              <span className="text-sm">Intelligent question routing</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Shield className="w-5 h-5 text-purple-400" />
              <span className="text-sm">Secure Google authentication</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
