'use client';

import { useState, useEffect } from 'react';
import { Flame, Copy, Share2, TrendingDown, TrendingUp, Zap, Shield, Users, ArrowRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { getWalletData } from '../utils/solana';
import { generateRoastMessage, getDiagnosis } from '../utils/roastLogic';


export default function Home() {
  const [walletAddress, setWalletAddress] = useState('');
  const [roastData, setRoastData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [roastCount, setRoastCount] = useState(0);
  const [shareToast, setShareToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  const showToast = (message: string) => {
    setShareToast({ show: true, message });
    setTimeout(() => setShareToast({ show: false, message: '' }), 4000);
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        // Handle new API response format or fallback
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
          setRoastCount(data.globalCount || 0);
        } else if (Array.isArray(data)) {
          // Legacy fallback
          setLeaderboard(data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch leaderboard", e);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchLeaderboard();
  }, []);

  const generateRoast = async () => {
    if (!walletAddress) return;
    setIsLoading(true);
    setRoastData(null); // Clear previous roast
    setError(null);

    const cacheKey = `roast_${walletAddress}`;
    const cachedData = localStorage.getItem(cacheKey);

    // Helper to submit roast to leaderboard
    const submitToLeaderboard = async (wallet: string, roast: string, stats: any) => {
      try {
        await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: wallet,
            roast: roast,
            stats: stats
          })
        });
        fetchLeaderboard(); // Refresh leaderboard
      } catch (e) {
        console.error("Leaderboard submit error", e);
      }
    };

    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        // Add a small artificial delay for "cooking" effect even if cached
        setTimeout(() => {
          setRoastData(parsed);
          setIsLoading(false);
          // Ensure cached results are also on the leaderboard
          submitToLeaderboard(walletAddress, parsed.roast, parsed.stats);
        }, 800);
        return;
      } catch (e) {
        console.error("Cache parse error", e);
        localStorage.removeItem(cacheKey);
      }
    }

    try {
      // 1. Fetch Real Data
      const walletData = await getWalletData(walletAddress);

      // 2. Generate Roast based on Real Data
      const { roast, stats } = generateRoastMessage(walletData);

      // 3. Set Data
      const diagnosis = getDiagnosis(walletAddress, walletData);
      const newRoastData = {
        roast,
        diagnosis,
        stats: {
          ...stats,
          solBalance: walletData.balance.toFixed(4),
          tokenCount: walletData.txCount, // Using tx count as proxy for now
          isWhale: walletData.isWhale,
          isBroke: walletData.isDust
        }
      };

      setRoastData(newRoastData);
      localStorage.setItem(cacheKey, JSON.stringify(newRoastData));

      // 4. Submit to Leaderboard
      await submitToLeaderboard(walletAddress, roast, newRoastData.stats);

    } catch (error: any) {
      console.error("Roast error:", error);
      setError(error.message || "Something went wrong cooking your wallet. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyRoast = () => {
    if (!roastData) return;
    const text = `My wallet got ROASTED! 🔥\n\n"${roastData.roast}"\n\nDiagnosis: ${roastData.diagnosis}\nPaper Hand Score: ${roastData.stats.paperHandScore}/100\nWin Rate: ${roastData.stats.winRate}%\n\nGet roasted at roastmywallet.fun`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnTwitter = async () => {
    if (!roastData) return;

    // 1. Generate Viral Text - optimized for clicks & engagement
    const viralText = `My wallet just got EXPOSED by @RoastMyWallet 💀\n\n"${roastData.roast}"\n\n🚨 Diagnosis: ${roastData.diagnosis}\n📉 Paper Hand Score: ${roastData.stats.paperHandScore}/100\n💸 Rugs Collected: ${roastData.stats.rugPulls}\n\nCheck your wallet (at your own risk) 👇\nhttps://roastmywallet.fun $ROAST`;

    // 2. Generate Image
    const element = document.getElementById('meme-card');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#000000',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // 3. Convert to Blob
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error("Image generation failed");

      const file = new File([blob], 'roast-my-wallet.png', { type: 'image/png' });

      // 4. Determine Device Type (Simple width check for Mobile vs Desktop)
      const isMobile = window.innerWidth <= 768;

      // 5. Mobile: Try Native Share First
      if (isMobile && navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Roast My Wallet',
          text: viralText,
          files: [file],
        });
        return;
      }

      // 6. Desktop: Prioritize Clipboard Magic 🪄
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
          })
        ]);
        showToast("Image copied! Just PASTE (Ctrl+V) it in the tweet! 📋");
      } catch (clipboardErr) {
        // Clipboard failed? If we haven't tried native share yet (e.g. standard desktop), try it now as fallback?
        // Or just go to download. Native share on desktop is usually annoying (as seen by user).
        console.warn("Clipboard failed, falling back to download", clipboardErr);

        // Final fallback: Download
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `roast-my-wallet-${Date.now()}.png`;
        link.click();
        showToast("Image downloaded! Drag it into the tweet! 📸");
      }

      // 7. Open Twitter Intent (Always do this on Desktop)
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(viralText)}`;
      window.open(url, '_blank');

    } catch (err) {
      console.error('Share failed:', err);
      showToast("Share failed. Try the manual download button below.");
    }
  };

  const generateMemeCard = async () => {
    const element = document.getElementById('meme-card');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#000000',
        scale: 2, // High resolution
        useCORS: true,
        logging: false,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `roast-my-wallet-${Date.now()}.png`;
      link.click();
    } catch (err: any) {
      console.error('Failed to generate meme card:', err);
      alert(`Failed to generate meme card: ${err.message || err}`);
    }
  };

  const CountdownTimer = () => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
      const calculateTimeLeft = () => {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1);
        nextHour.setMinutes(0, 0, 0); // Next top of the hour

        const diff = nextHour.getTime() - now.getTime();

        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      };

      const timer = setInterval(() => {
        setTimeLeft(calculateTimeLeft());
      }, 1000);

      setTimeLeft(calculateTimeLeft()); // Initial call

      return () => clearInterval(timer);
    }, []);

    return <>{timeLeft || '00:00:00'}</>;
  };

  return (
    <main className="relative min-h-screen bg-black text-white overflow-hidden font-sans selection:bg-orange-500 selection:text-white">

      {/* --- BACKGROUND EFFECTS (Guaranteed Visibility) --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Base Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-black to-black" />

        {/* Vibrant Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-red-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-orange-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.1 }} />
      </div>

      {/* --- CONTENT CONTAINER --- */}
      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">

        {/* TOAST NOTIFICATION */}
        <AnimatePresence>
          {shareToast.show && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-3 border border-white/20"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              {shareToast.message}
            </motion.div>
          )}
        </AnimatePresence>

        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-2">
              <Flame className="w-8 h-8 text-orange-500 fill-orange-500 animate-bounce" />
              <span className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-600">
                ROAST MY WALLET
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full border border-orange-500/20 text-sm font-bold">
              <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
                {roastCount.toLocaleString()} Roasted
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-grow flex flex-col items-center justify-center max-w-4xl mx-auto w-full text-center">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium">
              🔥 The most brutal crypto roaster
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-tight">
              Your Wallet is <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500">Trash.</span><br />
              Let's Prove It.
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Get brutally roasted for your terrible trading decisions.
              Hold <span className="text-orange-400 font-bold">$ROAST</span> to unlock premium insults.
            </p>
          </motion.div>

          {/* Daily Rekt Pot */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-12 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 p-4 rounded-2xl max-w-lg mx-auto backdrop-blur-sm relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-yellow-500/10 blur-xl group-hover:bg-yellow-500/20 transition-colors" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="text-left">
                <div className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  Hourly Rekt Pot <span className="animate-bounce">🏆</span>
                </div>
                <div className="text-2xl font-black text-white text-shadow-sm">0.1 SOL</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Resets In</div>
                <div className="text-xl font-mono font-bold text-white tabular-nums">
                  <CountdownTimer />
                </div>
              </div>
            </div>
            <div className="relative mt-3 text-xs text-yellow-200/70 border-t border-white/10 pt-2 flex justify-between items-center">
              <span>Worst wallet this hour wins!</span>
              <span className="font-bold text-white">
                Current Leader: {leaderboard.length > 0 ? `${leaderboard[0].rugPulls} Rugs Collected` : 'No Entry Yet'}
              </span>
            </div>
          </motion.div>

          {/* CA Display (Glowing Ember) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-8 flex flex-col items-center gap-6"
          >
            <div className="px-6 py-2 rounded-full border border-orange-500/50 bg-black/40 text-orange-200 font-mono text-sm tracking-wider shadow-[0_0_20px_rgba(249,115,22,0.4)] animate-pulse backdrop-blur-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_#f97316]"></span>
              CA: HQAoiZvpeAou1W5E49QjUSzFwXnVDoyiEGD7RhEBpump
              <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_#f97316]"></span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <a
                href="https://pump.fun/coin/HQAoiZvpeAou1W5E49QjUSzFwXnVDoyiEGD7RhEBpump"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-8 py-3 rounded-full font-bold transition-all shadow-[0_0_15px_rgba(234,88,12,0.5)] hover:shadow-[0_0_25px_rgba(234,88,12,0.8)] border border-orange-400/30 hover:scale-105 active:scale-95"
              >
                <Users className="w-5 h-5" />
                Buy $ROAST
              </a>

              <a
                href="https://x.com/roastmywallet_"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95"
              >
                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                </svg>
              </a>
            </div>
          </motion.div>

          {/* Roast Personas (Utility Teaser) */}
          <div className="mb-8 flex flex-wrap justify-center gap-3">
            {[
              { id: 'default', name: 'Standard Savage', icon: '🔥', locked: false },
              { id: 'gordon', name: 'Gordon Ramsay', icon: '👨‍🍳', locked: true },
              { id: 'egirl', name: 'UwU E-Girl', icon: '🎀', locked: true },
              { id: 'wallst', name: 'Wall St Bro', icon: '📈', locked: true },
            ].map((persona) => (
              <button
                key={persona.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${persona.locked
                  ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20'
                  }`}
              >
                <span>{persona.icon}</span>
                <span>{persona.name}</span>
                {persona.locked && <span className="text-[10px] bg-black/50 px-1.5 py-0.5 rounded text-gray-400">Hold $ROAST</span>}
              </button>
            ))}
          </div>

          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-full max-w-2xl relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-2xl">
              <div className="flex-grow relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Zap className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="Enter Solana wallet address or .sol domain..."
                  className="w-full bg-transparent text-white placeholder-gray-500 pl-12 pr-4 py-4 rounded-xl focus:outline-none focus:bg-white/5 transition-colors text-lg"
                />
              </div>
              <button
                onClick={generateRoast}
                disabled={isLoading || !walletAddress}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[160px] shadow-lg shadow-orange-900/20"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Cooking...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-5 h-5" />
                    <span>ROAST ME</span>
                  </>
                )}
              </button>
            </div>
            <div className="mt-4 flex flex-col items-center justify-center gap-2">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 font-bold bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg mb-2"
                >
                  ⚠️ {error}
                </motion.div>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Shield className="w-3 h-3" />
                100% Anonymous • No wallet connection required
              </div>
            </div>
          </motion.div>

          {/* Roast Result */}
          <AnimatePresence>
            {roastData && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="mt-16 w-full max-w-3xl"
              >
                <div className="relative bg-gray-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-12 overflow-hidden">
                  {/* Card Glow */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50" />

                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                        <Flame className="w-8 h-8 text-red-500" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Diagnosis</h3>
                        <p className="text-red-400 font-bold">{roastData.diagnosis}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Paper Hand Score</h3>
                      <p className="text-4xl font-black text-white">{roastData.stats.paperHandScore}<span className="text-lg text-gray-500 font-normal">/100</span></p>
                    </div>
                  </div>

                  <blockquote className="text-2xl md:text-3xl font-medium leading-relaxed mb-10 text-gray-100">
                    "{roastData.roast}"
                  </blockquote>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                      { label: "SOL Balance", value: `${roastData.stats.solBalance} ◎`, color: "text-purple-400" },
                      { label: "Memecoin Graveyard", value: roastData.stats.rugPulls, color: "text-orange-400" },
                      { label: "Desperation Rate", value: `${roastData.stats.athBuys}%`, color: "text-red-400" },
                      { label: "Days Since Rekt", value: `${roastData.stats.winRate}d`, color: "text-blue-400" },
                    ].map((stat, i) => (
                      <div key={i} className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <div className="text-xs text-gray-500 uppercase mb-1">{stat.label}</div>
                        <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={copyRoast}
                      className="flex-1 bg-white text-black hover:bg-gray-200 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      {copied ? <div className="w-5 h-5 text-green-600">✓</div> : <Copy className="w-5 h-5" />}
                      {copied ? "Copied!" : "Copy Roast"}
                    </button>
                    <button
                      id="share-btn"
                      onClick={shareOnTwitter}
                      className="flex-1 bg-black hover:bg-gray-900 text-white border border-white/20 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Share2 className="w-5 h-5" />
                      Share on X
                    </button>
                    <button
                      onClick={generateMemeCard}
                      className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors"
                      title="Download Meme Card"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hidden Meme Card Template */}
          {roastData && (
            <div className="fixed left-[-9999px] top-0 z-[-1]">
              <div id="meme-card" style={{
                width: '1200px',
                height: '675px',
                backgroundColor: '#000000',
                position: 'relative',
                overflow: 'hidden',
                fontFamily: '"Inter", sans-serif'
              }}>

                {/* Background Gradients */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right, #111827, #000000, #000000)' }} />
                <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '600px', height: '600px', borderRadius: '50%', background: 'rgba(220, 38, 38, 0.2)', filter: 'blur(100px)' }} />
                <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '600px', height: '600px', borderRadius: '50%', background: 'rgba(234, 88, 12, 0.2)', filter: 'blur(100px)' }} />

                {/* Main Border Container */}
                <div style={{
                  position: 'absolute',
                  top: '40px',
                  left: '40px',
                  right: '40px',
                  bottom: '40px',
                  border: '4px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '40px',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  zIndex: 10
                }}>

                  {/* Header - Absolute Top */}
                  <div style={{ position: 'absolute', top: '40px', left: '40px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Flame style={{ width: '48px', height: '48px', color: '#f97316', fill: '#f97316' }} />
                    <span style={{ color: '#ffffff', fontSize: '36px', fontWeight: '900', letterSpacing: '-0.05em' }}>ROAST MY WALLET</span>
                  </div>

                  <div style={{
                    position: 'absolute',
                    top: '40px',
                    right: '40px',
                    padding: '12px 32px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    fontWeight: '700',
                    fontSize: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}>
                    Official Diagnosis: {roastData.diagnosis}
                  </div>

                  {/* Left Column: Roast Text - Absolute Positioning */}
                  <div style={{
                    position: 'absolute',
                    top: '140px',
                    left: '40px',
                    width: '600px',
                    bottom: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <blockquote style={{
                      color: '#ffffff',
                      fontSize: '48px',
                      fontWeight: '800',
                      lineHeight: '1.1',
                      marginBottom: '32px',
                      textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                      letterSpacing: '-0.02em'
                    }}>
                      "{roastData.roast}"
                    </blockquote>
                    <div style={{ color: '#9ca3af', fontSize: '20px', fontFamily: 'monospace' }}>
                      roastmywallet.fun • $ROAST
                    </div>
                  </div>

                  {/* Right Column: Stats - Absolute Positioning */}
                  <div style={{
                    position: 'absolute',
                    top: '140px',
                    right: '40px',
                    width: '400px',
                    bottom: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between' // Distribute boxes evenly
                  }}>

                    {/* Stat Box 1: SOL */}
                    <div style={{
                      height: '110px',
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>SOL Balance</div>
                      <div style={{ color: '#ffffff', fontSize: '42px', fontWeight: '900', textShadow: '0 0 20px rgba(255,255,255,0.3)', letterSpacing: '-0.02em' }}>{roastData.stats.solBalance} ◎</div>
                    </div>

                    {/* Stat Box 2: Rugs */}
                    <div style={{
                      height: '110px',
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>Memecoin Graveyard</div>
                      <div style={{ color: '#f97316', fontSize: '56px', fontWeight: '900', textShadow: '0 0 20px rgba(249, 115, 22, 0.3)', letterSpacing: '-0.02em' }}>{roastData.stats.rugPulls}</div>
                    </div>

                    {/* Bottom Row Stats */}
                    <div style={{ display: 'flex', gap: '20px', height: '110px' }}>
                      <div style={{
                        flex: 1,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '2px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{ color: '#9ca3af', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>Desperation</div>
                        <div style={{ color: '#f87171', fontSize: '32px', fontWeight: '900', textShadow: '0 0 15px rgba(248, 113, 113, 0.3)', letterSpacing: '-0.02em' }}>{roastData.stats.athBuys}%</div>
                      </div>

                      <div style={{
                        flex: 1,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '2px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{ color: '#9ca3af', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>Days Rekt</div>
                        <div style={{ color: '#60a5fa', fontSize: '32px', fontWeight: '900', textShadow: '0 0 15px rgba(96, 165, 250, 0.3)', letterSpacing: '-0.02em' }}>{roastData.stats.winRate}d</div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Hall of Shame Leaderboard */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-24 w-full max-w-4xl mx-auto"
        >
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="p-2 bg-red-500/10 rounded-full border border-red-500/20">
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
              HALL OF SHAME
            </h2>
          </div>

          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-5">Wallet</div>
              <div className="col-span-3 text-right">Rug Pulls</div>
              <div className="col-span-3 text-right">Diagnosis</div>
            </div>

            {leaderboard.length > 0 ? (
              leaderboard.map((entry, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 items-center hover:bg-white/5 transition-colors group">
                  <div className="col-span-1 text-center font-bold text-gray-400">
                    {i === 0 ? '👑' : i + 1}
                  </div>
                  <div className="col-span-5 font-mono text-sm text-gray-300 flex items-center gap-2">
                    {entry.wallet.slice(0, 4)}...{entry.wallet.slice(-4)}
                    {i === 0 && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">RUG LORD</span>}
                  </div>
                  <div className="col-span-3 text-right font-bold text-orange-400">
                    {entry.rugPulls || 0} 💀
                  </div>
                  <div className="col-span-3 text-right text-xs text-gray-500 font-mono">
                    {getDiagnosis(entry.wallet)}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                Loading shame...
              </div>
            )}

            <div className="p-4 text-center border-t border-white/10 bg-white/5 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <div>
                <p className="text-xs text-gray-400 mb-1">Want to pin a wallet here?</p>
                <button className="text-xs font-bold bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors w-full sm:w-auto">
                  Hold 10k $ROAST
                </button>
              </div>
              <div className="hidden sm:block w-px h-8 bg-white/10" />
              <div>
                <p className="text-xs text-gray-400 mb-1">Remove your wallet?</p>
                <button className="text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-colors w-full sm:w-auto flex items-center gap-2">
                  <Shield className="w-3 h-3" /> Shield Mode (5k $ROAST)
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Roadmap Section */}
        <div className="mt-32 w-full max-w-4xl mx-auto px-4 relative">
          <div className="text-center mb-24">
            <h2 className="text-5xl font-black tracking-tighter mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent transform -rotate-2">
              ROADMAP TO <span className="text-orange-600 block text-8xl mt-2 drop-shadow-[0_0_25px_rgba(234,88,12,0.5)]">HELL</span>
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto text-lg leading-relaxed">
              Our master plan to turn your financial trauma into entertainment.
            </p>
          </div>

          <div className="relative space-y-16 before:content-[''] before:absolute before:left-4 md:before:left-1/2 before:top-0 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-transparent before:via-orange-500/50 before:to-transparent">
            {[
              {
                phase: "01",
                title: "Ignition Sequence",
                desc: "Fair launch of $ROAST token on Raydium. Implementation of token-gated features: Holders unlock the 'Gordon Ramsay' AI persona for maximum verbal abuse.",
                status: "done"
              },
              {
                phase: "02",
                title: "Fueling the Inferno",
                desc: "Aggressive marketing campaigns to onboard the masses. Automated developer buybacks funded by ad revenue. 100% of Liquidity Pool tokens locked forever.",
                status: "current"
              },
              {
                phase: "03",
                title: "Maximum Exposure",
                desc: "Integration with Enterprise RPCs (Helius/Triton) for deep history analysis. We'll start calculating 'Realized PnL' to generate heatmaps of your worst trades ever.",
                status: "pending"
              },
              {
                phase: "04",
                title: "The Cult of Roast",
                desc: "Establishing a self-sustaining ecosystem. Massive community buyback & burn events. Weekly 'Roast Championships' with $ROAST prizes to build the strongest community in crypto.",
                status: "pending"
              }
            ].map((item, i) => (
              <div key={i} className={`relative flex flex-col md:flex-row gap-8 items-center ${i % 2 === 0 ? 'md:flex-row-reverse' : ''
                }`}>
                {/* Timeline Dot */}
                <div className={`absolute left-4 md:left-1/2 w-4 h-4 -ml-2 rounded-full border-2 z-10 ${item.status === 'done'
                  ? 'bg-green-500 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]'
                  : item.status === 'current'
                    ? 'bg-orange-500 border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.8)]'
                    : 'bg-black border-gray-700'
                  }`} />

                <div className="flex-1 w-full md:w-1/2 pl-12 md:pl-0">
                  <div className={`p-8 rounded-3xl border backdrop-blur-sm transition-all duration-500 group hover:shadow-2xl hover:-translate-y-1 ${item.status === 'done'
                    ? 'bg-gradient-to-br from-green-500/10 to-black border-green-500/30'
                    : item.status === 'current'
                      ? 'bg-gradient-to-br from-orange-500/10 to-black border-orange-500/30'
                      : 'bg-white/5 border-white/5 hover:border-white/10'
                    }`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-6xl font-black opacity-20 ${item.status === 'done' ? 'text-green-500' : item.status === 'current' ? 'text-orange-500' : 'text-gray-500'
                        }`}>{item.phase}</span>

                      {item.status === 'current' && (
                        <span className="px-3 py-1 bg-orange-500 text-black text-xs font-bold uppercase rounded-full animate-pulse">
                          In Progress
                        </span>
                      )}

                      {item.status === 'done' && (
                        <span className="px-3 py-1 bg-green-500 text-black text-xs font-bold uppercase rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    <h3 className={`text-2xl font-black mb-3 ${item.status === 'done' || item.status === 'current' ? 'text-white' : 'text-gray-300'
                      }`}>
                      {item.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed font-light">
                      {item.desc}
                    </p>
                  </div>
                </div>

                {/* Empty space for alternate side */}
                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Tokenomics / Why Buy Section */}
        <div className="mt-32 w-full max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Hourly Rekt Pot 🏆</h2>
            <div className="text-4xl font-extrabold text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">
              0.1 SOL
            </div>
            <p className="text-sm text-gray-400 mt-2">Highest Rugs win.</p>
          </div>
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black tracking-tight mb-4">
              WHY HOLD <span className="text-orange-500">$ROAST</span>?
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              We're not just roasting wallets. We're building a utility ecosystem for the most savage community in crypto.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Unlock Personas", desc: "Access premium roast modes like 'Gordon Ramsay' & 'E-Girl'.", icon: "🎭" },
              { title: "Burn to Pin", desc: "Pay in $ROAST to pin your enemy's wallet to the Hall of Shame.", icon: "🔥" },
              { title: "Revenue Share", desc: "Top holders get a % of ad revenue from the site.", icon: "💰" },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-colors text-center group">
                <div className="text-4xl mb-6 transform group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-white">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Features */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto w-full">
          {[
            { icon: Flame, title: "Savage Roasts", desc: "AI-powered insults that hurt because they're true." },
            { icon: Shield, title: "100% Anonymous", desc: "No wallet connection. We don't want your dust." },
            { icon: TrendingUp, title: "Real Utility", desc: "Hold $ROAST to unlock premium features." },
          ].map((feature, i) => (
            <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-colors text-center md:text-left">
              <feature.icon className="w-8 h-8 text-orange-500 mb-4 mx-auto md:mx-0" />
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>

      </div >
    </main >
  );
}
