import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Music, 
  Zap, 
  CheckCircle, 
  ArrowRight,
  Star,
  Layers,
  Shield,
  Palette,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Music,
      title: 'Lyrics-to-Video AI Sync',
      description: 'Our exclusive AI analyzes your lyrics and generates perfectly synchronized scenes matching each line emotion.',
      badge: 'Exclusive'
    },
    {
      icon: Shield,
      title: 'Safety Analyzer',
      description: 'Real-time content checking prevents failed generations. Get smart alternatives before you waste credits.',
      badge: 'Smart'
    },
    {
      icon: Layers,
      title: 'Batch Scene Generation',
      description: 'Create multiple scenes at once for full music videos. Professional workflow, amateur effort.',
      badge: 'Pro'
    },
    {
      icon: Palette,
      title: 'Cover Art + SEO Suite',
      description: 'Generate album covers and platform-optimized metadata for YouTube, Spotify, Instagram, and TikTok.',
      badge: 'Complete'
    },
    {
      icon: Sparkles,
      title: 'Veo 3.1 Optimized Templates',
      description: '8 pre-tested visual styles including cyberpunk, dreamy, cinematic, and more. Professional results instantly.',
      badge: 'Easy'
    },
    {
      icon: TrendingUp,
      title: 'Beat-Synced Scenes (Coming)',
      description: 'Upload your audio and AI will detect beats, creating scene changes perfectly timed to your music.',
      badge: 'Soon'
    }
  ];

  const pricing = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      features: [
        '3 videos per month',
        'Single scene generation',
        'Basic templates',
        'Watermark included',
        'Community support'
      ],
      cta: 'Start Free',
      popular: false
    },
    {
      name: 'Creator Pro',
      price: '$29',
      period: 'per month',
      features: [
        '50 videos per month',
        'Batch generation (5 scenes)',
        'All templates',
        'Safety analyzer',
        'Cover art + SEO metadata',
        'No watermark',
        'Priority support'
      ],
      cta: 'Start Creating',
      popular: false
    },
    {
      name: 'Music Video Pro',
      price: '$79',
      period: 'per month',
      features: [
        '150 videos per month',
        '✨ Lyrics-to-video sync',
        'Unlimited batch scenes',
        'Priority processing',
        'Full SEO suite',
        'API access',
        'Dedicated support',
        'Early access to new features'
      ],
      cta: 'Go Pro',
      popular: true
    }
  ];

  const testimonials = [
    {
      name: 'Alex Chen',
      role: 'Independent Artist',
      content: 'The lyrics-sync feature is INSANE. My music video got 50K views in the first week. This is a game changer.',
      avatar: '🎸'
    },
    {
      name: 'Sarah Martinez',
      role: 'Music Producer',
      content: 'Used to spend $5K per video. Now I create 10 videos for $79/mo. The ROI is unbelievable.',
      avatar: '🎹'
    },
    {
      name: 'DJ Pulse',
      role: 'Electronic Artist',
      content: 'The batch generation saved me DAYS of work. Generated all scenes for my EP in one afternoon.',
      avatar: '🎧'
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">

        <div className="container mx-auto px-4 h-16 flex items-center justify-between">

          <div className="flex items-center gap-2">

            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>

            <span className="font-bold text-lg">VeoStudio Pro</span>
          </div>

          <Button onClick={() => navigate('/app')} variant="default">
            Launch App <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="secondary" className="mb-6">
            <Zap className="w-3 h-3 mr-1" />
            The Only AI That Syncs to Your Lyrics
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-gradient">Music Videos</span>
            <br />
            <span className="text-foreground">That Understand Your Vibe</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Stop spending $5K on music videos. Create professional, lyrics-synced videos 
            with AI for $29/month. From lyrics to visuals in minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={() => navigate('/app')} size="lg" variant="hero" className="text-lg px-8">
              Try Free <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline">
              Watch Demo
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            ✨ No credit card required • 3 free videos to start
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-secondary/20">
        <div className="container mx-auto max-w-6xl">

          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Features Nobody Else Has
            </h2>
            <p className="text-muted-foreground text-lg">
              We're not just another AI video tool. We're built specifically for musicians.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={idx}
                  className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant="secondary">{feature.badge}</Badge>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">

          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              Loved by Musicians Worldwide
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-card border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  "{testimonial.content}"
                </p>
                <div className="flex gap-1 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-secondary/20">
        <div className="container mx-auto max-w-5xl">

          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Honest Pricing
            </h2>
            <p className="text-muted-foreground text-lg">
              Start free. Upgrade when you're ready. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {pricing.map((plan, idx) => (
              <div 
                key={idx}
                className={`p-6 rounded-2xl border relative ${
                  plan.popular 
                    ? 'bg-primary/5 border-primary shadow-lg shadow-primary/10' 
                    : 'bg-card border-border'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Star className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                )}
                
                <h3 className="font-semibold text-xl mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>

                <Button 
                  className="w-full mb-6" 
                  variant={plan.popular ? 'hero' : 'outline'}
                  onClick={() => navigate('/app')}
                >
                  {plan.cta}
                </Button>

                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Create Your First Music Video?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join thousands of artists creating professional music videos with AI.
            No credit card required to start.
          </p>
          <Button onClick={() => navigate('/app')} size="lg" variant="hero" className="text-lg px-12">
            Start Creating Free <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground text-sm">
            © 2024 VeoStudio Pro. The World's First Lyrics-Synced AI Music Video Generator.
          </p>
          <p className="text-muted-foreground/60 text-xs mt-2">
            Powered by Google Veo 3.1
          </p>
        </div>
      </footer>

    </div>
  );
};
