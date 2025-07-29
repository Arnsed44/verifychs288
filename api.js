// GitHub Pages API Handler - Replace YOUR_BOT_API_URL with your actual Discord bot endpoint
const BOT_API_URL = 'https://your-discord-bot-domain.com/api/verify'; // CHANGE THIS TO YOUR BOT'S API URL

class GitHubPagesAPI {
  constructor() {
    this.rateLimit = new Map();
  }

  // Rate limiting check
  checkRateLimit(discordUserId, ip) {
    const key = `${discordUserId}:${ip}`;
    const now = Date.now();
    const limit = this.rateLimit.get(key);
    
    if (limit && (now - limit.lastAttempt) < 15 * 60 * 1000 && limit.attempts >= 3) {
      if (limit.blockedUntil && now < limit.blockedUntil) {
        return { blocked: true, blockedUntil: new Date(limit.blockedUntil) };
      }
    }
    
    return { blocked: false };
  }

  // Update rate limiting
  updateRateLimit(discordUserId, ip) {
    const key = `${discordUserId}:${ip}`;
    const now = Date.now();
    const existing = this.rateLimit.get(key);
    
    if (existing && (now - existing.lastAttempt) < 15 * 60 * 1000) {
      const newAttempts = existing.attempts + 1;
      this.rateLimit.set(key, {
        attempts: newAttempts,
        lastAttempt: now,
        blockedUntil: newAttempts >= 3 ? now + (60 * 60 * 1000) : null
      });
    } else {
      this.rateLimit.set(key, {
        attempts: 1,
        lastAttempt: now,
        blockedUntil: null
      });
    }
  }

  // Submit verification to Discord bot
  async submitVerification(verificationData) {
    try {
      // Get user's IP (approximation)
      const ip = await this.getUserIP();
      
      // Check rate limiting
      const rateLimitResult = this.checkRateLimit(verificationData.discordUserId, ip);
      if (rateLimitResult.blocked) {
        throw new Error('Rate limited. Please try again later.');
      }

      // Update rate limit counter
      this.updateRateLimit(verificationData.discordUserId, ip);

      // Send to Discord bot
      const response = await fetch(BOT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...verificationData,
          ipAddress: ip,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Verification failed`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Verification error:', error);
      throw error;
    }
  }

  // Get user's IP address (basic approximation)
  async getUserIP() {
    try {
      // Try to get IP via WebRTC
      return new Promise((resolve) => {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });
        
        pc.createDataChannel("");
        pc.createOffer().then(pc.setLocalDescription.bind(pc));
        
        pc.onicecandidate = (ice) => {
          if (!ice || !ice.candidate || !ice.candidate.candidate) return;
          
          const myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate);
          if (myIP) {
            resolve(myIP[1]);
            pc.close();
          }
        };
        
        // Fallback after 3 seconds
        setTimeout(() => {
          resolve("unknown");
          pc.close();
        }, 3000);
      });
    } catch (error) {
      return "unknown";
    }
  }
}

// Export for use in main application
window.GitHubPagesAPI = GitHubPagesAPI;
