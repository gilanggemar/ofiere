'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { useAssemblyStore } from '@/store/useAssemblyStore'
import { Logo } from '@/components/logo'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [navigating, setNavigating] = useState(false)
    const router = useRouter()
    const signIn = useAuthStore((s) => s.signIn)
    const loading = useAuthStore((s) => s.loading)
    const user = useAuthStore((s) => s.user)
    const initialized = useAuthStore((s) => s.initialized)
    const showAssembly = useAssemblyStore((s) => s.show)

    useEffect(() => {
        if (initialized && user) {
            setNavigating(true)
            showAssembly()
            router.push('/dashboard')
        }
    }, [initialized, user, router, showAssembly])

    const handleLogin = async () => {
        setError(null)
        if (!email.trim() || !password.trim()) {
            setError('Please enter your email and password.')
            return
        }
        // Fire assembly animation IMMEDIATELY — before auth even starts
        showAssembly()
        setNavigating(true)

        const result = await signIn(email, password)
        if (result.error) {
            // Auth failed — hide assembly and show error
            useAssemblyStore.getState().reset()
            setNavigating(false)
            setError(result.error)
        } else {
            // Auth succeeded — navigate while assembly is already playing
            router.push('/dashboard')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !navigating) {
            handleLogin()
        }
    }

    const isDisabled = loading || navigating

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={navigating
                    ? { opacity: 0, y: -20, scale: 0.95 }
                    : { opacity: 1, y: 0, scale: 1 }
                }
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                className="w-full max-w-md mx-4 rounded-md px-10 py-12 space-y-8"
                style={{
                    pointerEvents: navigating ? 'none' : 'auto',
                    backgroundColor: 'rgba(10, 10, 10, 0.7)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
                }}
            >
                {/* Mobile logo */}
                <div className="flex items-center gap-2.5 lg:hidden mb-4">
                    <Logo className="h-8 w-8 text-white" />
                    <span className="text-2xl font-bold tracking-tight text-white">OFIERE</span>
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-white">
                        Sign In
                    </h2>
                    <p className="text-sm text-neutral-400">
                        Enter your credentials to access the dashboard.
                    </p>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                <div className="space-y-5">
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="operator@ofiere.ai"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={navigating}
                            className="flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/40 transition-all duration-200 disabled:opacity-40"
                            autoComplete="email"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={navigating}
                            className="flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/40 transition-all duration-200 disabled:opacity-40"
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={isDisabled}
                        className="flex h-11 w-full items-center justify-center rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                        style={{ backgroundColor: isDisabled ? '#c2650a' : '#e87a13' }}
                        onMouseEnter={(e) => { if (!isDisabled) (e.currentTarget.style.backgroundColor = '#c2650a') }}
                        onMouseLeave={(e) => { if (!isDisabled) (e.currentTarget.style.backgroundColor = '#e87a13') }}
                    >
                        {loading || navigating ? (
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {navigating ? 'Launching Ofiere...' : 'Authenticating...'}
                            </div>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10" />
                    </div>
                </div>

                <p className="text-center text-sm text-neutral-500">
                    Don&apos;t have an account?{' '}
                    <Link href="/signup" className="text-white hover:underline underline-offset-4 font-medium">
                        Create one
                    </Link>
                </p>
            </motion.div>
        </>
    )
}

// touch