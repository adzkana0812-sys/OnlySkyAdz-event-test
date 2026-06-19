import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MoreVertical,
  User,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Sliders,
  DollarSign,
  CloudUpload,
  Clock,
  Menu,
  ChevronRight,
  ShieldCheck,
  Send,
  Sparkles,
  Search,
  Check,
  RefreshCw,
  HelpCircle,
  X,
  Bell,
  BellRing,
  Volume2,
  VolumeX
} from "lucide-react";
import { RobloxProfile, Submission, SubmissionStats } from "./types";

export default function App() {
  // Navigation & Core view states
  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(false);
  const [isAdminAuthMenuOpen, setIsAdminAuthMenuOpen] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [adminAuthToken, setAdminAuthToken] = useState<string>(() => {
    return localStorage.getItem("admin_password_token") || "";
  });

  // Client User Form States
  const [robloxUsername, setRobloxUsername] = useState<string>("");
  const [isVerifyingUser, setIsVerifyingUser] = useState<boolean>(false);
  const [verifiedProfile, setVerifiedProfile] = useState<RobloxProfile | null>(null);
  const [gamepassLink, setGamepassLink] = useState<string>("");
  
  // Screenshot Upload States
  const [proofImage, setProofImage] = useState<{ name: string; base64: string } | null>(null);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form submission status
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");

  // User Tab selection state
  const [userActiveTab, setUserActiveTab] = useState<"form" | "status">("form");
  const [statusSearchUsername, setStatusSearchUsername] = useState<string>("");
  const [searchedSubmissions, setSearchedSubmissions] = useState<any[]>([]);
  const [isSearchingStatus, setIsSearchingStatus] = useState<boolean>(false);
  const [checkedOnce, setCheckedOnce] = useState<boolean>(false);

  // Device Active Verification State (1 submission per device control)
  const [deviceActiveSubmission, setDeviceActiveSubmission] = useState<any | null>(null);
  const [deviceRejectedSubmission, setDeviceRejectedSubmission] = useState<any | null>(null);
  const [isCheckingDevice, setIsCheckingDevice] = useState<boolean>(true);

  // Admin Data States
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string>("");

  // Real-time auto-polling & notification states
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [newPendingAlerts, setNewPendingAlerts] = useState<any[]>([]);
  const [lastCheckedTime, setLastCheckedTime] = useState<Date>(new Date());
  const knownSubmissionsRef = useRef<string[]>([]);

  // Notification Toasts
  const [toasts, setToasts] = useState<{ id: string; type: "success" | "error" | "info"; message: string }[]>([]);

  // Show Toast Toast Notification
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Check login on load
  useEffect(() => {
    if (adminAuthToken) {
      fetchSubmissions();
    }
  }, [adminAuthToken]);

  // Background polling for real-time updates
  useEffect(() => {
    if (!adminAuthToken || !isAutoRefresh) return;

    // Fetch every 8 seconds
    const interval = setInterval(() => {
      fetchSubmissions(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [adminAuthToken, isAutoRefresh]);

  // Method to check device submission status
  const checkDeviceSubmissionStatus = async () => {
    setIsCheckingDevice(true);
    const savedIdsStr = localStorage.getItem("event_submission_ids");
    if (!savedIdsStr) {
      setDeviceActiveSubmission(null);
      setDeviceRejectedSubmission(null);
      setIsCheckingDevice(false);
      return;
    }
    try {
      const ids = JSON.parse(savedIdsStr);
      if (Array.isArray(ids) && ids.length > 0) {
        const resp = await fetch("/api/submissions/check-statuses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.submissions && data.submissions.length > 0) {
            // Find if there is any active/pending or approved submission on this device
            const active = data.submissions.find(
              (s: any) => s.status === "pending" || s.status === "approved"
            );
            
            // Find if there is any rejected submission on this device as well
            const rejected = data.submissions.filter((s: any) => s.status === "rejected");
            const newestRejected = rejected.length > 0 
              ? rejected.reduce((prev: any, current: any) => (new Date(prev.createdAt) > new Date(current.createdAt) ? prev : current))
              : null;

            if (active) {
              setDeviceActiveSubmission(active);
            } else {
              setDeviceActiveSubmission(null);
            }

            if (newestRejected) {
              setDeviceRejectedSubmission(newestRejected);
            } else {
              setDeviceRejectedSubmission(null);
            }
          } else {
            setDeviceActiveSubmission(null);
            setDeviceRejectedSubmission(null);
          }
        }
      } else {
        setDeviceActiveSubmission(null);
        setDeviceRejectedSubmission(null);
      }
    } catch (err) {
      console.error("Error checking device status:", err);
    } finally {
      setIsCheckingDevice(false);
    }
  };

  // Check device active submission status on mount/load
  useEffect(() => {
    checkDeviceSubmissionStatus();
  }, []);

  // Sync click outside to close triple-dot menu
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAdminAuthMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch verified Roblox profile info
  const handleVerifyRobloxUser = async () => {
    if (!robloxUsername.trim()) {
      showToast("Tuliskan nama pengguna Roblox Anda!", "error");
      return;
    }

    setIsVerifyingUser(true);
    setVerifiedProfile(null);

    try {
      const response = await fetch(`/api/roblox-user/${encodeURIComponent(robloxUsername.trim())}`);
      const data = await response.json();

      if (response.ok && !data.error) {
        setVerifiedProfile({
          id: data.id,
          username: data.username,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
        });
        showToast(`Akun Roblox ${data.username} terdeteksi!`, "success");
      } else {
        showToast(data.error || "Nama Roblox tidak ditemukan.", "error");
      }
    } catch (error) {
      showToast("Gagal memverifikasi akun Roblox. Silakan coba lagi.", "error");
    } finally {
      setIsVerifyingUser(false);
    }
  };

  // Convert uploaded image to Base64
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Harap unggah file gambar (PNG, JPG, JPEG)!", "error");
      return;
    }
    
    // Check file size (limit 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast("Ukuran gambar terlalu besar! Maksimum 10MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProofImage({
          name: file.name,
          base64: reader.result,
        });
        showToast("Bukti gambar berhasil diunggah!", "success");
      }
    };
    reader.onerror = () => {
      showToast("Gagal membaca file gambar.", "error");
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const onFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  };

  // Submit Form to Backend
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verifiedProfile) {
      showToast("Verifikasi username Roblox Anda terlebih dahulu!", "error");
      return;
    }

    if (!proofImage) {
      showToast("Harap unggah screenshot bukti buat game pass!", "error");
      return;
    }

    setSubmitStatus("submitting");

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: verifiedProfile.username,
          imageProof: proofImage.base64,
          gamepassLink: gamepassLink,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSubmitStatus("success");
        showToast("Bukti pengajuan berhasil dikirim!", "success");

        // Save submission ID to device localStorage for 1-submission-per-device restriction
        if (data.submission && data.submission.id) {
          const savedIdsStr = localStorage.getItem("event_submission_ids");
          let ids = [];
          if (savedIdsStr) {
            try {
              ids = JSON.parse(savedIdsStr);
            } catch (e) {}
          }
          if (!Array.isArray(ids)) ids = [];
          ids.push(data.submission.id);
          localStorage.setItem("event_submission_ids", JSON.stringify(ids));
          setDeviceActiveSubmission(data.submission);
          setDeviceRejectedSubmission(null);
        }
      } else {
        setSubmitStatus("error");
        setSubmitMessage(data.error || "Gagal mengirim pengajuan.");
        showToast(data.error || "Terjadi kesalahan saat mengirim formulir.", "error");
      }
    } catch (err) {
      setSubmitStatus("error");
      setSubmitMessage("Koneksi gagal atau terjadi gangguan server.");
      showToast("Kesalahan jaringan. Harap coba lagi.", "error");
    }
  };

  // Reset Client Flow Form
  const handleResetForm = () => {
    setVerifiedProfile(null);
    setRobloxUsername("");
    setProofImage(null);
    setGamepassLink("");
    setSubmitStatus("idle");
    setSubmitMessage("");
    setCheckedOnce(false);
    setSearchedSubmissions([]);
    setStatusSearchUsername("");
  };

  // Handle user checking their status
  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusSearchUsername.trim()) {
      showToast("Harap masukkan username Roblox Anda!", "error");
      return;
    }

    setIsSearchingStatus(true);
    setCheckedOnce(true);
    setSearchedSubmissions([]);

    try {
      const response = await fetch(`/api/submissions/status/${encodeURIComponent(statusSearchUsername.trim())}`);
      const data = await response.json();
      if (response.ok && data.submissions) {
        setSearchedSubmissions(data.submissions);
        if (data.submissions.length > 0) {
          showToast(`Ditemukan ${data.submissions.length} riwayat pengajuan!`, "success");
        } else {
          showToast("Username ini belum terdaftar atau tidak ditemukan.", "info");
        }
      } else {
        showToast(data.error || "Gagal mengambil status.", "error");
      }
    } catch (err) {
      showToast("Gagal menghubungi server. Harap coba lagi.", "error");
    } finally {
      setIsSearchingStatus(false);
    }
  };

  // Admin Panel Actions
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");

    try {
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setAdminAuthToken(adminPassword);
        localStorage.setItem("admin_password_token", adminPassword);
        setIsAdminView(true);
        setShowAdminLogin(false);
        setIsAdminAuthMenuOpen(false);
        setAdminPassword("");
        setShowPassword(false);
        showToast("Login Admin Berhasil!", "success");
      } else {
        setAdminError(data.error || "Password salah!");
      }
    } catch (err) {
      setAdminError("Gagal menghubungi server admin");
    }
  };

  const handleLogout = () => {
    setAdminAuthToken("");
    localStorage.removeItem("admin_password_token");
    setIsAdminView(false);
    showToast("Logout dari Admin Panel", "info");
  };

  // Web Audio API Sound Synthesizer
  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const now = ctx.currentTime;
      playTone(550, now, 0.35); // E5
      playTone(730, now + 0.1, 0.45); // G#5
    } catch (e) {
      console.warn("AudioContext block/error", e);
    }
  };

  const fetchSubmissions = async (silent: boolean = false) => {
    if (!adminAuthToken) return;
    if (!silent) setIsLoadingSubmissions(true);

    try {
      const response = await fetch("/api/submissions", {
        headers: {
          "x-admin-password": adminAuthToken,
        },
      });

      const data = await response.json();
      if (response.ok && data.submissions) {
        const incoming: Submission[] = data.submissions;
        
        // Check for newborn pending notifications
        if (knownSubmissionsRef.current.length === 0) {
          // Initialize known list
          knownSubmissionsRef.current = incoming.map((s) => s.id);
        } else {
          const freshPendings = incoming.filter(
            (sub) => sub.status === "pending" && !knownSubmissionsRef.current.includes(sub.id)
          );

          if (freshPendings.length > 0) {
            // New pendings found! Keep known updated
            knownSubmissionsRef.current = [
              ...knownSubmissionsRef.current,
              ...freshPendings.map((s) => s.id),
            ];

            // Prevent spamming alerts if multiple incoming, but register them properly
            setNewPendingAlerts((prev) => {
              const unique = [...prev];
              freshPendings.forEach((np) => {
                if (!unique.some((u) => u.id === np.id)) {
                  unique.push(np);
                }
              });
              return unique;
            });

            // Play clean synthesized beep
            if (isSoundEnabled) {
              playNotificationSound();
            }

            // Create system-wide toasts & notifications
            if (freshPendings.length === 1) {
              showToast(`Peringatan: Pengajuan pending baru masuk dari ${freshPendings[0].username}!`, "info");
            } else {
              showToast(`Peringatan: ${freshPendings.length} pengajuan pending baru terdeteksi!`, "info");
            }
          } else {
            // Keep known ref in sync with general DB items, so we don't treat modified items as new
            const allCurrentIds = incoming.map((s) => s.id);
            knownSubmissionsRef.current = Array.from(new Set([...knownSubmissionsRef.current, ...allCurrentIds]));
          }
        }

        setSubmissions(incoming);
        setLastCheckedTime(new Date());
      } else {
        if (!silent) {
          showToast("Otorisasi kedaluwarsa atau salah.", "error");
          handleLogout();
        }
      }
    } catch (err) {
      if (!silent) {
        showToast("Gagal memuat submissions.", "error");
      }
    } finally {
      if (!silent) setIsLoadingSubmissions(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: "approved" | "rejected" | "pending") => {
    try {
      const response = await fetch(`/api/submissions/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminAuthToken,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setSubmissions((prev) =>
          prev.map((sub) => (sub.id === id ? { ...sub, status: newStatus } : sub))
        );
        showToast(`Status pengajuan berhasil diubah menjadi ${newStatus === "approved" ? "Disetujui" : newStatus === "rejected" ? "Ditolak" : "Pending"}!`, "success");
      } else {
        showToast("Gagal memperbarui status.", "error");
      }
    } catch (err) {
      showToast("Kesalahan jaringan.", "error");
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data pengajuan ini?")) return;

    try {
      const response = await fetch(`/api/submissions/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": adminAuthToken,
        },
      });

      if (response.ok) {
        setSubmissions((prev) => prev.filter((sub) => sub.id !== id));
        showToast("Pengajuan berhasil dihapus!", "success");
      } else {
        showToast("Gagal menghapus pengajuan.", "error");
      }
    } catch (err) {
      showToast("Kesalahan jaringan.", "error");
    }
  };

  const handleClearAllSubmissions = async () => {
    if (!window.confirm("PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data pengajuan? Tidakan ini bersifat permanen!")) return;

    try {
      const response = await fetch("/api/submissions/clear", {
        method: "POST",
        headers: {
          "x-admin-password": adminAuthToken,
        },
      });

      if (response.ok) {
        setSubmissions([]);
        showToast("Semua data pengajuan berhasil dibersihkan!", "success");
      } else {
        showToast("Gagal membersihkan data.", "error");
      }
    } catch (err) {
      showToast("Kesalahan jaringan.", "error");
    }
  };

  const handleCopyText = (text: string, label: string = "Teks") => {
    navigator.clipboard.writeText(text);
    showToast(`${label} disalin ke papan klip!`, "success");
  };

  // Derived Stats for admin panel
  const getSubmissionsStats = (): SubmissionStats => {
    return {
      total: submissions.length,
      pending: submissions.filter((s) => s.status === "pending").length,
      approved: submissions.filter((s) => s.status === "approved").length,
      rejected: submissions.filter((s) => s.status === "rejected").length,
    };
  };

  const stats = getSubmissionsStats();
  const filteredSubmissions = submissions.filter((sub) => {
    return (
      sub.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col relative antialiased selection:bg-rose-500 selection:text-white">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-slate-900/20 rounded-full blur-[130px] pointer-events-none" />

      {/* Floating Toast Notification Containers */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className="pointer-events-auto"
            >
              <div className={`p-4 rounded-xl shadow-2xl flex items-start gap-3 border backdrop-blur-md ${
                toast.type === "success"
                  ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/20"
                  : toast.type === "error"
                  ? "bg-rose-950/90 text-rose-300 border-rose-500/20"
                  : "bg-slate-900/90 text-slate-300 border-slate-700/20"
              }`}>
                {toast.type === "success" && <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />}
                {toast.type === "error" && <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />}
                {toast.type === "info" && <HelpCircle className="w-5 h-5 flex-shrink-0 text-sky-400 mt-0.5" />}
                <p className="text-sm font-medium leading-normal">{toast.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div id="main-header" className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-rose-600 to-rose-400 rounded-lg shadow-lg shadow-rose-950/40">
              {/* Distinct Roblox Red Styled hexagon replacement Icon */}
              <div className="w-5 h-5 border-2 border-white transform rotate-45 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white"></div>
              </div>
            </div>
            <div>
              <span className="font-display font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                RBX Portal
              </span>
              <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/10">
                VERIFIED
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle standard view / Admin view directly if logged in */}
            {adminAuthToken && (
              <button
                id="btn-admin-view-toggle"
                onClick={() => setIsAdminView(!isAdminView)}
                className="hidden sm:flex items-center gap-2 px-3 .py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-rose-400" />
                {isAdminView ? "Ke Portal Pengajuan" : "Ke Admin Panel"}
              </button>
            )}

            {/* Menu Admin Login (Tiga Titik) */}
            <div className="relative" ref={menuRef}>
              <button
                id="btn-admin-config"
                onClick={() => setIsAdminAuthMenuOpen(!isAdminAuthMenuOpen)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition text-slate-400 hover:text-white"
                title="Pilihan Admin"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              <AnimatePresence>
                {isAdminAuthMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900 border border-slate-800 p-2 shadow-2xl z-50 text-left"
                  >
                    {!adminAuthToken ? (
                      <button
                        id="btn-trigger-login-modal"
                        onClick={() => {
                          setShowAdminLogin(true);
                          setIsAdminAuthMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                      >
                        <Lock className="w-4 h-4 text-slate-400" />
                        Masuk Admin Panel
                      </button>
                    ) : (
                      <>
                        <button
                          id="btn-admin-nav-toggle"
                          onClick={() => {
                            setIsAdminView(!isAdminView);
                            setIsAdminAuthMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        >
                          <Sliders className="w-4 h-4 text-slate-400" />
                          {isAdminView ? "Portal Pengaju" : "Panel Admin"}
                        </button>
                        <button
                          id="btn-admin-logoff"
                          onClick={() => {
                            handleLogout();
                            setIsAdminAuthMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                        >
                          <LogOut className="w-4 h-4" />
                          Keluar Admin
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Login Modal overlay */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-rose-500" />
                  <h3 className="font-display font-medium text-lg text-slate-100">Login Admin Panel</h3>
                </div>
                <button
                  id="btn-close-login-modal"
                  onClick={() => {
                    setShowAdminLogin(false);
                    setAdminPassword("");
                    setAdminError("");
                    setShowPassword(false);
                  }}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAdminLoginSubmit} className="p-6 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Masukkan Password Admin
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-slate-500" />
                    </div>
                    <input
                      id="input-admin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan Password Admin"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                      autoFocus
                    />
                    <button
                      id="btn-toggle-password-visibility"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition cursor-pointer"
                      title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {adminError && (
                    <p className="mt-2 text-xs text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {adminError}
                    </p>
                  )}
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    id="btn-cancel-admin-auth"
                    type="button"
                    onClick={() => {
                      setShowAdminLogin(false);
                      setAdminPassword("");
                      setAdminError("");
                      setShowPassword(false);
                    }}
                    className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    id="btn-signin-admin"
                    type="submit"
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-semibold text-white shadow-lg shadow-rose-950/20 transition cursor-pointer"
                  >
                    Masuk Panel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Space */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 relative">
        <AnimatePresence mode="wait">
          {/* VIEW 1: ADMIN CONTROL PANEL */}
          {isAdminView && adminAuthToken ? (
            <motion.div
              key="admin-dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Admin Panel Header info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-rose-500" />
                    <h1 className="font-display font-medium text-xl md:text-2xl text-slate-100">
                      Panel Kontrol Administrasi
                    </h1>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Verifikasi bukti gamepass 500 Robux dari berbagai pendaftar Roblox
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    id="btn-refresh-data"
                    onClick={fetchSubmissions}
                    disabled={isLoadingSubmissions}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSubmissions ? "animate-spin" : ""}`} />
                    Segarkan Data
                  </button>
                  <button
                    id="btn-bulk-clear"
                    onClick={handleClearAllSubmissions}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs bg-rose-950/30 hover:bg-rose-950/50 border border-rose-900/30 text-rose-400 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Pendaftar
                  </button>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold tracking-wider block uppercase">
                      Total Pendaftar
                    </span>
                    <span className="font-display font-semibold text-2xl text-slate-100 mt-1 block">
                      {stats.total}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-amber-400 font-semibold tracking-wider block uppercase">
                      Status Pending
                    </span>
                    <span className="font-display font-semibold text-2xl text-amber-400 mt-1 block">
                      {stats.pending}
                    </span>
                  </div>
                  <div className="p-2.5 bg-amber-950/20 border border-amber-900/20 rounded-xl text-amber-400">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-semibold tracking-wider block uppercase">
                      Telah Disetujui
                    </span>
                    <span className="font-display font-semibold text-2xl text-emerald-400 mt-1 block">
                      {stats.approved}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-950/20 border border-emerald-900/20 rounded-xl text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-rose-400 font-semibold tracking-wider block uppercase">
                      Telah Ditolak
                    </span>
                    <span className="font-display font-semibold text-2xl text-rose-400 mt-1 block">
                      {stats.rejected}
                    </span>
                  </div>
                  <div className="p-2.5 bg-rose-950/20 border border-rose-900/20 rounded-xl text-rose-400">
                    <XCircle className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* REAL-TIME MONITORING CONTROL PANEL & RADAR */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-3 w-3">
                    {isAutoRefresh && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isAutoRefresh ? "bg-rose-500" : "bg-slate-600"}`}></span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      Pemantauan Pengajuan Real-Time
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isAutoRefresh 
                        ? `Sistem mengawasi pendaftar baru secara otomatis (Pengecekan setiap 8s). Terakhir: ${lastCheckedTime.toLocaleTimeString("id-ID")}`
                        : "Pemantauan otomatis dijeda. Aktifkan untuk menerima peringatan suara otomatis."
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  {/* Sound Toggle */}
                  <button
                    id="btn-toggle-sound"
                    onClick={() => {
                      setIsSoundEnabled(!isSoundEnabled);
                      showToast(!isSoundEnabled ? "Suara notifikasi diaktifkan" : "Suara notifikasi dibisukan", "info");
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold tracking-wide transition cursor-pointer ${
                      isSoundEnabled 
                        ? "bg-slate-900 border-slate-800 text-rose-400 hover:bg-slate-850" 
                        : "bg-slate-950 border-slate-900 text-slate-500 hover:bg-slate-900"
                    }`}
                  >
                    {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{isSoundEnabled ? "Suara Aktif" : "Suara Senyap"}</span>
                  </button>

                  {/* Auto refresh Toggle */}
                  <button
                    id="btn-toggle-auto-refresh"
                    onClick={() => {
                      setIsAutoRefresh(!isAutoRefresh);
                      showToast(!isAutoRefresh ? "Pemantauan otomatis diaktifkan" : "Pemantauan otomatis dimatikan", "info");
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold tracking-wide transition cursor-pointer ${
                      isAutoRefresh 
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20" 
                        : "bg-slate-950 border-slate-900 text-slate-500 hover:bg-slate-900"
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAutoRefresh ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
                    <span>{isAutoRefresh ? "Auto Polling On" : "Auto Polling Off"}</span>
                  </button>
                </div>
              </div>

              {/* REAL-TIME ALERT NOTIFICATIONS FEED */}
              <AnimatePresence>
                {newPendingAlerts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-1 select-none">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider animate-pulse">
                        <BellRing className="w-4 h-4 text-amber-400" />
                        Peringatan Pengajuan Pending Baru ({newPendingAlerts.length})
                      </span>
                      <button
                        id="btn-dismiss-all-alerts"
                        onClick={() => setNewPendingAlerts([])}
                        className="text-[10px] text-slate-400 hover:text-slate-200 underline font-medium transition cursor-pointer"
                      >
                        Bersihkan Semua Peringatan
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {newPendingAlerts.map((alert) => (
                        <motion.div
                          key={`alert-${alert.id}`}
                          layout
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                          className="bg-amber-950/20 border-2 border-amber-500/40 rounded-xl p-4 flex gap-4 items-start shadow-xl shadow-amber-950/10 hover:border-amber-500/60 transition"
                        >
                          {/* Alert avatar info */}
                          <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-850 overflow-hidden flex items-center justify-center flex-shrink-0 select-none">
                            <img
                              src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(alert.username)}`}
                              alt="avatar"
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full"
                            />
                          </div>

                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                                  {alert.username}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-sans">
                                  Mengajukan 500 Robux &bull; {new Date(alert.createdAt).toLocaleTimeString("id-ID")}
                                </p>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/10">
                                PENDING
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 leading-normal font-sans">
                              Pengajuan baru terdeteksi di database dan sedang menunggu keputusan rilis.
                            </p>

                            <div className="flex items-center gap-2 pt-1">
                              {/* Focus Button */}
                              <button
                                id={`btn-alert-focus-${alert.id}`}
                                onClick={() => {
                                  setSearchQuery(alert.username);
                                  showToast(`Memfilter daftar ke username: ${alert.username}`, "info");
                                  
                                  // Smooth scroll to table view
                                  const tableEl = document.getElementById("admin-search-box");
                                  if (tableEl) {
                                    tableEl.scrollIntoView({ behavior: "smooth", block: "center" });
                                    tableEl.focus();
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] font-semibold text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                              >
                                <Search className="w-3 h-3" />
                                <span>Fokus &amp; Periksa</span>
                              </button>

                              {/* Dismiss alert */}
                              <button
                                id={`btn-alert-dismiss-${alert.id}`}
                                onClick={() => setNewPendingAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                                className="px-2 py-1 rounded hover:bg-slate-900 text-[10px] font-semibold text-slate-400 hover:text-slate-300 transition flex items-center gap-1 cursor-pointer"
                              >
                                <span>Sembunyikan</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Filtering Submissions */}
              <div className="flex bg-slate-900/40 border border-slate-900 rounded-xl p-3 items-center gap-3">
                <Search className="w-4.5 h-4.5 text-slate-500 ml-1.5" />
                <input
                  id="admin-search-box"
                  type="text"
                  placeholder="Cari berdasarkan Nama Roblox atau Status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-0 ring-0 focus:outline-none text-sm text-slate-100 placeholder-slate-500"
                />
                {searchQuery && (
                  <button
                    id="btn-clear-search"
                    onClick={() => setSearchQuery("")}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 text-xs transition"
                  >
                    Batal
                  </button>
                )}
              </div>

              {/* Submissions Section */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden">
                {isLoadingSubmissions ? (
                  <div className="flex flex-col items-center justify-center p-20 space-y-4">
                    <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                    <p className="text-sm text-slate-400">Memproses data submissions dari database...</p>
                  </div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-16 text-center">
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-full text-slate-500 mb-4">
                      <User className="w-6 h-6" />
                    </div>
                    <h3 className="font-medium text-slate-300">Belum Ada Bukti Pengajuan</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1.5">
                      {searchQuery
                        ? "Pendaftar yang dicari tidak cocok dengan kata kunci."
                        : "Seluruh data user yang mengirim roblox username dan screenshot screenshot gamepass 500 Robux akan tampil di sini."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-900 select-none">
                          <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Pendaftar Roblox
                          </th>
                          <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Tautan Gamepass
                          </th>
                          <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Tanggal Kirim
                          </th>
                          <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Status Akun
                          </th>
                          <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
                            Foto Bukti
                          </th>
                          <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">
                            Aksi Moderasi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {filteredSubmissions.map((sub) => {
                          const subDate = new Date(sub.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <tr key={sub.id} className="hover:bg-slate-900/20 group transition">
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  {/* Dynamic Roblox Headshot avatar image or fallback colored block */}
                                  <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                                    <img
                                      src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(sub.username)}`}
                                      alt="avatar"
                                      referrerPolicy="no-referrer"
                                      className="w-8 h-8 rounded-full"
                                    />
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-sm text-slate-100 flex items-center gap-1.5 leading-none">
                                      {sub.username}
                                      <button
                                        id={`btn-copy-${sub.id}`}
                                        onClick={() => handleCopyText(sub.username, "Username")}
                                        className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition"
                                        title="Salin Username"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </h4>
                                    <span className="text-[10px] text-slate-500 italic mt-0.5 block">ID: {sub.id}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-4">
                                {sub.gamepassLink ? (
                                  <div className="flex items-center gap-1.5">
                                    <a
                                      href={sub.gamepassLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-rose-400 hover:text-rose-300 font-medium hover:underline flex items-center gap-1 max-w-[200px] truncate"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                      Game Pass Link
                                    </a>
                                    <button
                                      id={`btn-copy-link-${sub.id}`}
                                      onClick={() => handleCopyText(sub.gamepassLink, "Link gamepass")}
                                      className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500 font-medium italic">Tidak terlampir</span>
                                )}
                              </td>

                              <td className="py-4 px-4 text-xs text-slate-400">
                                {subDate}
                              </td>

                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  sub.status === "approved"
                                    ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                                    : sub.status === "rejected"
                                    ? "bg-rose-950/40 text-rose-400 border border-rose-500/20"
                                    : "bg-amber-950/40 text-amber-400 border border-amber-500/20"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    sub.status === "approved"
                                      ? "bg-emerald-400"
                                      : sub.status === "rejected"
                                      ? "bg-rose-400"
                                      : "bg-amber-400"
                                  }`} />
                                  {sub.status === "approved" && "Disetujui"}
                                  {sub.status === "rejected" && "Ditolak"}
                                  {sub.status === "pending" && "Menunggu Review"}
                                </span>
                              </td>

                              <td className="py-4 px-4 text-center">
                                <button
                                  id={`btn-view-proof-${sub.id}`}
                                  onClick={() => setSelectedProof(sub.imageProof)}
                                  className="mx-auto flex h-10 w-14 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 overflow-hidden items-center justify-center cursor-pointer transition relative group/img"
                                  title="Lihat Screenshot Penuh"
                                >
                                  <img
                                    src={sub.imageProof}
                                    alt="screenshot proof"
                                    className="w-full h-full object-cover opacity-75 group-hover/img:opacity-100 transition"
                                  />
                                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition">
                                    <Eye className="w-4 h-4 text-white" />
                                  </div>
                                </button>
                              </td>

                              <td className="py-4 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {sub.status !== "approved" && (
                                    <button
                                      id={`btn-approve-${sub.id}`}
                                      onClick={() => handleUpdateStatus(sub.id, "approved")}
                                      className="p-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-950 border border-emerald-900/30 hover:border-emerald-500 text-emerald-400 transition cursor-pointer"
                                      title="Setujui Bukti"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  )}
                                  {sub.status !== "rejected" && (
                                    <button
                                      id={`btn-reject-${sub.id}`}
                                      onClick={() => handleUpdateStatus(sub.id, "rejected")}
                                      className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950 border border-rose-900/30 hover:border-rose-500/50 text-rose-400 transition cursor-pointer"
                                      title="Tolak Bukti"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    id={`btn-delete-${sub.id}`}
                                    onClick={() => handleDeleteSubmission(sub.id)}
                                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                    title="Hapus Submission"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* FAQ ADMIN PANEL: TECHNICAL GUIDELINES & TROUBLESHOOTING PROMPT */}
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-2.5 border-b border-slate-900 pb-4">
                  <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-100">
                      FAQ Admin & Panduan Teknis Moderasi
                    </h2>
                    <p className="text-xs text-slate-400">
                      Instruksi langkah-demi-langkah bagi tim moderator untuk memverifikasi bukti gamepass dan menangani kendala teknis dari pendaftar.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Column 1: Verification Flow */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-rose-500 rounded-full inline-block" />
                      Langkah Verifikasi Bukti Game Pass
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex gap-3 bg-slate-950/40 border border-slate-850/50 p-3.5 rounded-xl">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold font-mono flex items-center justify-center">
                          1
                        </span>
                        <div className="text-xs space-y-1">
                          <p className="font-semibold text-slate-200">Verifikasi Username Roblox</p>
                          <p className="text-slate-400 leading-relaxed font-sans">
                            Pastikan username Roblox yang diinput sesuai dengan screenshot bukti. Gunakan tombol <b className="text-slate-300">Salin</b> untuk mencocokkan atau memeriksa profil aslinya di platform Roblox secara langsung.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 bg-slate-950/40 border border-slate-850/50 p-3.5 rounded-xl">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold font-mono flex items-center justify-center">
                          2
                        </span>
                        <div className="text-xs space-y-1">
                          <p className="font-semibold text-slate-200">Periksa Parameter 500 Robux</p>
                          <p className="text-slate-400 leading-relaxed font-sans">
                            Pastikan nominal pembuatan Game Pass di akun pendaftar disetel seharga <span className="text-rose-400 font-semibold">500 Robux</span>. Sesuai komisi 30% Roblox, Anda (selaku pembeli/grup) akan mengeluarkan 500 Robux, dan kreator/pendaftar menerima bersih sebesar 350 Robux.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 bg-slate-950/40 border border-slate-850/50 p-3.5 rounded-xl">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold font-mono flex items-center justify-center">
                          3
                        </span>
                        <div className="text-xs space-y-1">
                          <p className="font-semibold text-slate-200">Validasi Screenshot / File Bukti</p>
                          <p className="text-slate-400 leading-relaxed font-sans">
                            Periksa gambar bukti secara detail. Screenshot harus menampilkan dasbor pembuatan, menu penjualan gamepass, atau halaman detail pass. Tolak pengajuan jika gambar menunjukkan bukti palsu, editan (Inspect Element), buram, atau tidak terbaca.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 bg-slate-950/40 border border-slate-850/50 p-3.5 rounded-xl">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold font-mono flex items-center justify-center">
                          4
                        </span>
                        <div className="text-xs space-y-1">
                          <p className="font-semibold text-slate-200">Kroscek Riwayat Transaksi Penjualan</p>
                          <p className="text-slate-400 leading-relaxed font-sans">
                            Buka dasbor Roblox Anda atau akun grup di menu <code className="px-1 text-[10px] bg-slate-900 border border-slate-800 rounded text-rose-400 font-mono">Summary &rarr; Sales of Goods</code> atau <code className="px-1 text-[10px] bg-slate-900 border border-slate-800 rounded text-rose-400 font-mono">My Transactions</code> untuk memastikan saldo Robux dari pembelian pass tersebut telah masuk berstatus "Pending".
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Technical Troubleshooting Guidelines */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-rose-500 rounded-full inline-block" />
                      Prosedur Menangani Kendala Teknis Pendaftar
                    </h3>

                    <div className="space-y-3.5 text-xs">
                      {/* Issue 1 */}
                      <div className="p-3.5 bg-slate-950/40 border border-slate-850/50 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-2 text-rose-400 font-semibold font-sans">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Kendala: Username Roblox Tidak Terdeteksi</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">
                          <strong className="text-slate-300">Penyebab:</strong> Pendaftar seringkali menginput "Display Name" (Nama Tampilan) alih-alih "Username" utama mereka yang diawali simbol @ di profil akun Roblox.
                          <br />
                          <strong className="text-slate-300">Langkah Solusi:</strong> Sarankan pendaftar untuk mengecek kembali profil Roblox mereka, mengambil nama pengguna asli di bawah display name, kemudian mendaftar ulang setelah pengajuan ditolak demi keamanan pencarian.
                        </p>
                      </div>

                      {/* Issue 2 */}
                      <div className="p-3.5 bg-slate-950/40 border border-slate-850/50 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-2 text-rose-400 font-semibold font-sans">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Kendala: Pesan "Verifikasi Terkunci (Beli 1 Kali)"</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">
                          <strong className="text-slate-300">Penyebab:</strong> Sistem proteksi anti-spam memblokir pendaftaran baru jika perangkat/browser pendaftar terdeteksi sudah memiliki status pengajuan yang <span className="text-amber-400 font-medium">pending</span> atau <span className="text-emerald-400 font-medium">approved</span>.
                          <br />
                          <strong className="text-slate-300">Langkah Solusi:</strong> Pendaftar baru bisa mengirim ulang jika pengajuan sebelumnya <span className="text-rose-400 font-semibold">ditolak</span> oleh admin. Jika mereka salah mengisi data dan ingin mengajukan ulang secara instan, admin harus menolak pengajuan tersebut terlebih dahulu atau pendaftar dapat menghapus cache local storage browsernya.
                        </p>
                      </div>

                      {/* Issue 3 */}
                      <div className="p-3.5 bg-slate-950/40 border border-slate-850/50 rounded-xl space-y-1.5">
                        <div className="flex items-center gap-2 text-rose-400 font-semibold font-sans">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Kendala: Tautan Game Pass Tidak Valid atau Error</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">
                          <strong className="text-slate-300">Penyebab:</strong> Pendaftar bingung cara menyalin tautan gamepass atau salah menyalin tautan game utama (experience).
                          <br />
                          <strong className="text-slate-300">Langkah Solusi:</strong> Informasikan bahwa tautan game pass bersifat opsional dan boleh dikosongkan. Yang terpenting adalah mengunggah screenshot bukti valid. Admin bisa memproses moderasi secara manual dengan mencari nama pengguna Roblox tersebut di inventarisasi publik.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* VIEW 2: CLIENT USER SUBMISSION FORM (GORGEOUS MULTI-STEP SINGLE-PAGE APP) */
            <motion.div
              key="user-submission-interface"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              {/* Header Box Greeting */}
              <div className="text-center py-4 space-y-2 select-none">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/10 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  Klaim Hadiah 500 Robux (Termasuk Pajak)
                </span>
                <h1 className="font-display font-bold text-3xl md:text-4xl text-slate-100 tracking-tight">
                  Verifikasi Menyelesaikan Event
                </h1>
                <p className="text-sm text-slate-400 max-w-lg mx-auto">
                  Selesaikan pembuatan Game Pass sebesar 500 Robux di akun Anda (nominal Robux yang dikirim sudah termasuk pajak Roblox yang ditanggung). Unggah screenshot bukti, dan tunggu tim moderator memproses rilis Robux Anda!
                </p>
              </div>

              {/* RULES & PROTOCOLS (Aturan Event) */}
              <div className="bg-slate-900/40 border border-slate-800/40 rounded-2xl p-5 space-y-4">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                  Syarat & Ketentuan Terkirim (Aturan Penting)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs text-slate-500 leading-relaxed">
                  <div className="flex items-start gap-2.5 bg-slate-950/40 border border-slate-850/50 p-3 rounded-xl">
                    <span className="text-rose-400 font-bold font-mono">1.</span>
                    <p>
                      <strong className="text-slate-200">Foto Bukti Harus Jelas:</strong> Jika screenshot buram, disunting/palsu, terpotong, atau tidak terbaca, pengajuan Anda <span className="text-rose-400 font-semibold">akan otomatis ditolak</span>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/40 border border-slate-850/50 p-3 rounded-xl">
                    <span className="text-rose-400 font-bold font-mono">2.</span>
                    <p>
                      <strong className="text-slate-200">Nama Pengguna Sesuai:</strong> Jika username Roblox yang Anda masukkan salah atau typo, verifikasi <span className="text-rose-400 font-semibold">akan langsung ditolak</span>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/40 border border-slate-850/50 p-3 rounded-xl">
                    <span className="text-rose-400 font-bold font-mono">3.</span>
                    <p>
                      <strong className="text-slate-200">Game Pass Aktif:</strong> Jika Anda tidak membuat Game Pass sebesar 500 Robux di profil akun Roblox Anda, pengajuan <span className="text-rose-400 font-semibold">akan ditolak</span>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/40 border border-slate-850/50 p-3 rounded-xl">
                    <span className="text-rose-400 font-bold font-mono">4.</span>
                    <p>
                      <strong className="text-slate-300">Bisa Verifikasi Ulang:</strong> Jika pendaftaran Anda <span className="text-rose-400 font-semibold">ditolak</span>, Anda <span className="text-emerald-400 font-semibold">selalu bisa mengajukan ulang kembali</span> dengan data yang benar!
                    </p>
                  </div>
                </div>
                <div className="bg-rose-500/5 text-rose-400 text-center text-[10px] p-2.5 rounded-xl border border-rose-500/10 font-medium">
                  🔒 Batasan Perangkat: 1 Perangkat hanya dapat memiliki 1 pengajuan aktif (Menunggu / Disetujui).
                </div>
              </div>

              {/* Tab Selector for User Panel */}
              <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl max-w-sm mx-auto select-none">
                <button
                  type="button"
                  id="tab-user-form"
                  onClick={() => setUserActiveTab("form")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                    userActiveTab === "form"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-950/20"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Kirim Bukti Baru
                </button>
                <button
                  type="button"
                  id="tab-user-status"
                  onClick={() => setUserActiveTab("status")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                    userActiveTab === "status"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-950/20"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Cek Status Pengajuan
                </button>
              </div>

              {userActiveTab === "status" ? (
                /* STATUS CHECKER TAB PANEL */
                <motion.div
                  key="user-status-checker"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-slate-900/60 border border-slate-900 rounded-2xl p-6 shadow-xl space-y-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400 flex-shrink-0">
                      <Clock className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="font-display font-medium text-slate-100">Periksa Status Verifikasi Anda</h3>
                      <p className="text-xs text-slate-400">
                        Cari menggunakan username Roblox Anda untuk melihat apakah pendaftaran Anda disetujui, ditolak, atau masih diproses.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleCheckStatus} className="flex flex-col sm:flex-row gap-3 pt-2">
                    <div className="relative flex-1">
                      <input
                        id="status-search-username"
                        type="text"
                        placeholder="Contoh: UsernameRobloxAnda"
                        value={statusSearchUsername}
                        onChange={(e) => setStatusSearchUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="w-4.5 h-4.5 text-slate-500" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="btn-submit-status-check"
                      disabled={isSearchingStatus}
                      className="px-6 py-3 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-semibold text-white shadow-lg shadow-rose-955/20 transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isSearchingStatus ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          Mencari...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 text-white" />
                          Cari Status
                        </>
                      )}
                    </button>
                  </form>

                  {/* Results area */}
                  {checkedOnce && (
                    <div className="pt-4 border-t border-slate-850 space-y-4">
                      {searchedSubmissions.length === 0 ? (
                        <div className="text-center py-8 space-y-2">
                          <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-900 flex items-center justify-center text-slate-500 mx-auto">
                            <AlertCircle className="w-5 h-5 text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-300">Data Tidak Ditemukan</p>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                            Nama pengguna Roblox <span className="font-semibold text-rose-400">"{statusSearchUsername}"</span> belum didaftarkan atau salah mengeja username. Harap mendaftar terlebih dahulu!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">
                            Riwayat Pengajuan ({searchedSubmissions.length})
                          </span>

                          <div className="space-y-3.5">
                            {searchedSubmissions.map((item) => {
                              const submissionDate = new Date(item.createdAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              });

                              return (
                                <div
                                  key={item.id}
                                  className="bg-slate-955 border border-slate-800/60 p-5 rounded-2xl space-y-4"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
                                        <img
                                          src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(item.username)}`}
                                          alt="avatar"
                                          className="w-7 h-7 rounded-full"
                                        />
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-1 font-mono">
                                          @{item.username}
                                        </h4>
                                        <span className="text-[10px] text-slate-500">{submissionDate}</span>
                                      </div>
                                    </div>

                                    <div>
                                      {item.status === "approved" && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-950/20">
                                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                          Disetujui
                                        </span>
                                      )}
                                      
                                      {item.status === "rejected" && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-955/65 text-rose-400 border border-rose-500/20 shadow-lg shadow-rose-950/20 font-sans">
                                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                          Ditolak
                                        </span>
                                      )}

                                      {item.status === "pending" && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-955/65 text-amber-400 border border-amber-550/25 shadow-lg shadow-amber-950/20">
                                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                                          Menunggu Review
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Explanation messages based on statuses */}
                                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/40 text-xs text-slate-300 leading-relaxed">
                                    {item.status === "approved" && (
                                      <div className="space-y-1">
                                        <p className="font-semibold text-emerald-400 flex items-center gap-1">
                                          <Sparkles className="w-3.5 h-3.5" />
                                          Selamat! Pengajuan Anda Berhasil Disetujui!
                                        </p>
                                        <p className="text-slate-400 font-sans">
                                          Hadiah Robux sebesar <span className="font-semibold text-slate-200">500 Robux</span> sedang didistribusikan ke akun Roblox Anda. Harap periksa saldo Roblox Anda secara berkala! Proses pengiriman biasanya memakan waktu maksimal 5-7 hari sesuai ketentuan Roblox.
                                        </p>
                                      </div>
                                    )}

                                    {item.status === "rejected" && (
                                      <div className="space-y-1">
                                        <p className="font-semibold text-rose-400 flex items-center gap-1">
                                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                                          Pengajuan Anda Ditolak oleh Admin
                                        </p>
                                        <p className="text-slate-400 font-sans">
                                          Maaf, bukti transfer atau pembuatan game pass yang Anda unggah terbukti tidak valid atau tidak memenuhi syarat (tidak sesuai dengan ketentuan 500 Robux). Silakan buat game pass baru dengan benar, ambil screenshot bukti yang valid, dan kirimkan ulang melalui tab <strong className="text-rose-400 underline cursor-pointer hover:text-rose-300" onClick={() => setUserActiveTab("form")}>"Kirim Bukti Baru"</strong>.
                                        </p>
                                      </div>
                                    )}

                                    {item.status === "pending" && (
                                      <div className="space-y-1">
                                        <p className="font-semibold text-amber-400 flex items-center gap-1">
                                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                                          Pengajuan Sedang Dalam Pemeriksaan Berkas
                                        </p>
                                        <p className="text-slate-400 font-sans">
                                          Data pendaftaran Anda telah diterima dengan aman dan sedang mengantre untuk diperiksa manual oleh tim moderator. Pengecekan membutuhkan waktu maksimal <span className="font-semibold text-slate-200">24 jam</span>. Terima kasih telah bersabar!
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ) : (
                <>
                {deviceActiveSubmission ? (
                  /* DEVICE IS BLOCKED FROM NEW VERIFICATION UNTIL STATUS IS REJECTED */
                  <motion.div
                    key="device-limit-alert"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-900/60 border border-slate-900 rounded-2xl p-6 shadow-xl text-center space-y-6"
                  >
                    <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/20">
                      <AlertTriangle className="w-8 h-8 animate-bounce" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-display text-xl font-bold text-slate-100">Verifikasi Terkunci (Batas 1 Kali)</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                        Anda hanya diizinkan memverifikasi <span className="font-semibold text-rose-400 font-mono">1 kali per perangkat</span>. Perangkat ini sudah memiliki pengajuan aktif yang tersimpan.
                      </p>
                    </div>

                    <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 max-w-md mx-auto text-left space-y-4">
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-900">
                        <div className="w-9 h-9 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
                          <img
                            src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(deviceActiveSubmission.username)}`}
                            alt="avatar"
                            className="w-7 h-7 rounded-full"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Username Terdaftar</span>
                          <h4 className="text-sm font-semibold text-slate-100 font-mono">@{deviceActiveSubmission.username}</h4>
                        </div>
                        <div className="ml-auto">
                          {deviceActiveSubmission.status === "approved" ? (
                            <span className="inline-flex items-center gap-1.1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 shadow-md">
                              DISETUJUI
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-550/25 shadow-md">
                              PROSES REVIEW
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 leading-relaxed font-sans space-y-2">
                        {deviceActiveSubmission.status === "approved" ? (
                          <div className="bg-emerald-950/10 p-3.5 rounded-xl border border-emerald-500/10">
                            <span className="font-semibold text-emerald-400 block mb-1">🎁 Hadiah Robux Terselesaikan</span>
                            <p>Pengajuan Event Anda telah disetujui! Hadiah 500 Robux sedang didistribusikan ke akun Anda. Harap tidak menghapus Game Pass sampai proses transfer selesai.</p>
                          </div>
                        ) : (
                          <div className="bg-amber-950/10 p-3.5 rounded-xl border border-amber-500/10">
                            <span className="font-semibold text-amber-400 block mb-1">⏳ Sedang Diperiksa Manual</span>
                            <p>Akun Anda sedang dalam antrean review moderator. Harap bersabar menunggu maksimal 24 jam sebelum status diperbarui.</p>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-500 italic text-center pt-2 leading-normal">
                          Catatan: Jika bukti terbukti salah/tidak jelas dan moderator menolaknya, tombol kirim bukti baru ini akan otomatis terbuka kembali di perangkat ini!
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2 max-w-md mx-auto">
                      <button
                        type="button"
                        id="btn-force-refresh-device"
                        onClick={checkDeviceSubmissionStatus}
                        className="flex-1 py-3 hover:bg-slate-800 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Segarkan Status
                      </button>
                      <button
                        type="button"
                        id="btn-goto-status-tab"
                        onClick={() => {
                          setStatusSearchUsername(deviceActiveSubmission.username);
                          setUserActiveTab("status");
                        }}
                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-md shadow-rose-950/20"
                      >
                        Detail Riwayat Pengajuan
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <>
                  {submitStatus === "success" ? (
                /* Success screen */
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-slate-900 border border-slate-850 rounded-2xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
                  
                  <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/20">
                    <CheckCircle className="w-8 h-8" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-display text-xl font-bold text-slate-100">Bukti Verifikasi Terkirim!</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Sistem kami berhasil mencatat data username Roblox <span className="text-rose-400 font-semibold">@{verifiedProfile?.username}</span> beserta screenshot bukti game pass Anda.
                    </p>
                  </div>

                  {/* Profile mini-card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-w-xs mx-auto flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 overflow-hidden flex-shrink-0">
                      <img src={verifiedProfile?.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full" />
                    </div>
                    <div className="text-left leading-none">
                      <span className="text-xs text-slate-400 leading-none">Roblox User</span>
                      <h4 className="font-semibold text-sm text-slate-100 mt-1">{verifiedProfile?.username}</h4>
                    </div>
                    <div className="ml-auto">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        PENDING
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60 max-w-md mx-auto space-y-2">
                    <span className="text-xs font-semibold text-rose-500 uppercase flex items-center justify-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      WAKTU PENGECEKAN
                    </span>
                    <p className="text-xs text-slate-400 leading-normal">
                      Admin akan memeriksa validitas Game Pass dan screenshot dalam jangka waktu <span className="font-semibold text-slate-200">1 x 24 jam</span>. Jika valid, Robux akan segera didepositokan ke akun pendaftar.
                    </p>
                  </div>

                  <button
                    id="btn-return-form"
                    onClick={handleResetForm}
                    className="px-6 py-2.5 bg-slate-900 border border-slate-850 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition duration-200 cursor-pointer inline-flex items-center gap-2"
                  >
                    Selesai & Cek Status
                  </button>
                </motion.div>
              ) : (
                /* Primary Submission Form */
                <form onSubmit={handleSubmitForm} className="space-y-6">
                  {deviceRejectedSubmission && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 flex gap-4 items-start shadow-lg"
                    >
                      <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400 flex-shrink-0 animate-pulse">
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                      </div>
                      <div className="space-y-1 text-xs">
                        <h4 className="font-bold text-rose-400">Pemberitahuan: Pengajuan Sebelumnya Ditolak</h4>
                        <p className="text-slate-300 leading-relaxed font-sans">
                          Sistem mendeteksi bahwa pengajuan dengan nama akun <b className="text-slate-100 font-mono">@{deviceRejectedSubmission.username}</b> telah diperiksa oleh tim moderator dan berstatus <b className="text-rose-400">Ditolak</b> karena bukti/screenshot yang dikirim tidak valid atau tidak memenuhi syarat.
                        </p>
                        <p className="text-slate-400 leading-normal pt-1 flex items-center gap-1.5 font-sans">
                          <span>Silakan kirimkan kembali berkas bukti yang baru dengan benar di bawah ini.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setStatusSearchUsername(deviceRejectedSubmission.username);
                              setUserActiveTab("status");
                              setIsSearchingStatus(true);
                              setCheckedOnce(true);
                              fetch(`/api/submissions/status/${encodeURIComponent(deviceRejectedSubmission.username)}`)
                                .then(r => r.json())
                                .then(d => {
                                  if (d.submissions) setSearchedSubmissions(d.submissions);
                                })
                                .finally(() => setIsSearchingStatus(false));
                            }}
                            className="text-rose-400 underline font-semibold hover:text-rose-300 transition cursor-pointer"
                          >
                            Detail Riwayat &rarr;
                          </button>
                        </p>
                      </div>
                    </motion.div>
                  )}
                  
                  {/* STEP 1: ROBLOX USER VERIFICATION */}
                  <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400 flex-shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-medium text-slate-100">Langkah 1: Verifikasi Akun Roblox</h3>
                        <p className="text-xs text-slate-400">Lakukan verifikasi username Roblox sebelum mengirimkan screenshot bukti.</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <div className="relative flex-1">
                        <input
                          id="input-roblox-username"
                          type="text"
                          disabled={verifiedProfile !== null}
                          placeholder="Masukkan nama pengguna Roblox..."
                          value={robloxUsername}
                          onChange={(e) => setRobloxUsername(e.target.value)}
                          className={`w-full pl-10 pr-4 py-3 bg-slate-950 border rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition ${
                            verifiedProfile ? "border-emerald-500/30 text-slate-400 bg-slate-950/60" : "border-slate-800"
                          }`}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="w-4.5 h-4.5 text-slate-500" />
                        </div>
                      </div>

                      {verifiedProfile ? (
                        <button
                          id="btn-change-roblox-user"
                          type="button"
                          onClick={() => {
                            setVerifiedProfile(null);
                            setRobloxUsername("");
                          }}
                          className="px-5 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
                        >
                          Ganti Akun
                        </button>
                      ) : (
                        <button
                          id="btn-verify-roblox"
                          type="button"
                          onClick={handleVerifyRobloxUser}
                          disabled={isVerifyingUser || !robloxUsername}
                          className="px-5 py-3 bg-slate-100 hover:bg-white text-slate-950 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                        >
                          {isVerifyingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          Periksa Akun
                        </button>
                      )}
                    </div>

                    {/* Roblox visual Profile Details Card */}
                    <AnimatePresence>
                      {verifiedProfile && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 p-4 bg-slate-950 border border-emerald-500/10 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                                <img
                                  src={verifiedProfile.avatarUrl}
                                  alt="roblox Avatar"
                                  className="w-10 h-10 object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="leading-tight">
                                <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">
                                  Akun Roblox Ditemukan
                                </span>
                                <h4 className="font-semibold text-sm text-slate-100 mt-0.5">
                                  {verifiedProfile.username}{" "}
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    ({verifiedProfile.displayName})
                                  </span>
                                </h4>
                                <span className="text-[10px] text-slate-500 block mt-0.5">ID: {verifiedProfile.id}</span>
                              </div>
                            </div>
                            <div className="h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* TUTORIAL & STEP PART: HOW TO CREATE GAME PASS TO 500 ROBUX */}
                  <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400 flex-shrink-0">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-medium text-slate-100 mb-0.5">
                          Langkah 2: Buat Game Pass 500 Robux
                        </h3>
                        <p className="text-xs text-slate-400 leading-normal">
                          Ikuti panduan berikut untuk membuat game pass baru agar verifikasi berjalan cepat dan lancar:
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 select-none">
                      <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-1.5 relative overflow-hidden">
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full uppercase">
                          Tutorial 1
                        </span>
                        <h4 className="font-semibold text-xs text-slate-200 uppercase tracking-wide">
                          Masuk Ke Dashboard Creator
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Buka situs resmi <a href="https://create.roblox.com/dashboard/creations" target="_blank" rel="noopener noreferrer" className="text-rose-400 underline font-medium inline-flex items-center gap-0.5 hover:text-rose-300">create.roblox.com <ExternalLink className="w-3 h-3" /></a> di browser Anda, kemudian login.
                        </p>
                      </div>

                      <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-1.5 relative overflow-hidden">
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full uppercase">
                          Tutorial 2
                        </span>
                        <h4 className="font-semibold text-xs text-slate-200 uppercase tracking-wide">
                          Pilih Game &amp; Tambahkan Pass
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Pilih salah satu Game (Experience) Anda, masuk ke menu <strong className="text-slate-300 font-medium">Associated Items</strong>, lalu klik tab <strong className="text-slate-300 font-medium">Passes</strong>.
                        </p>
                      </div>

                      <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-1.5 relative overflow-hidden">
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full uppercase">
                          Tutorial 3
                        </span>
                        <h4 className="font-semibold text-xs text-rose-400 uppercase tracking-wide flex items-center gap-1">
                          Setel Harga: 500 Robux
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Aktifkan opsi <strong className="text-slate-300 font-medium">"Item for Sale"</strong>, lalu masukkan nominal harga sebesar <strong className="text-rose-400 font-bold">500 Robux</strong> persis.
                        </p>
                      </div>

                      <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl space-y-1.5 relative overflow-hidden">
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full uppercase">
                          Tutorial 4
                        </span>
                        <h4 className="font-semibold text-xs text-slate-200 uppercase tracking-wide">
                          Simpan &amp; Screenshot Bukti
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Tekan tombol <strong className="text-slate-300 font-medium">Save Changes</strong> untuk menyimpan gamepass. Pastikan Anda mengambil gambar / screenshot sebagai bukti transfer.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Tautan Game Pass (Opsional)
                        </label>
                        <span className="text-[10px] text-slate-500 italic">Tidak diisi juga tidak apa-apa</span>
                      </div>
                      <div className="relative">
                        <input
                          id="input-gamepass-link"
                          type="url"
                          placeholder="Contoh: https://www.roblox.com/game-pass/123456/MyPass (Boleh dikosongkan)"
                          value={gamepassLink}
                          onChange={(e) => setGamepassLink(e.target.value)}
                          className="w-full pl-3 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500/50"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                        *Catatan: Tidak memasukkan link Game Pass tidak apa-apa / boleh dilewati. Yang paling penting adalah mengunggah screenshot bukti yang valid pada Langkah 3 di bawah.
                      </p>
                    </div>
                  </div>

                  {/* STEP 3: PROOF SCREENSHOT UPLOAD */}
                  <div className="bg-slate-900/60 border border-slate-900 rounded-2xl p-6 shadow-xl space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400 flex-shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-medium text-slate-100">Langkah 3: Unggah Bukti Transaksi</h3>
                        <p className="text-xs text-slate-400">Silakan kirimkan tangkapan layar (screenshot) sebagai bukti pembuatan Game Pass sebesar 500 Robux.</p>
                      </div>
                    </div>

                    {/* Integrated custom drag and drop area */}
                    <div
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[160px] ${
                        isDragActive
                          ? "border-rose-500 bg-rose-500/5"
                          : proofImage
                          ? "border-emerald-500/30 bg-emerald-500/2"
                          : "border-slate-800 bg-slate-950 hover:bg-slate-900 hover:border-slate-700"
                      }`}
                    >
                      <input
                        id="input-file-proof"
                        type="file"
                        ref={fileInputRef}
                        onChange={onFileSelectChange}
                        accept="image/*"
                        className="hidden"
                      />

                      {proofImage ? (
                        <div className="space-y-3.5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center">
                            <div className="h-16 w-24 bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-lg relative group/preview">
                              <img src={proofImage.base64} alt="screenshot selection" className="w-full h-full object-cover" />
                              <button
                                id="btn-cancel-image-selection"
                                onClick={() => setProofImage(null)}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover/preview:opacity-100 flex items-center justify-center text-rose-400 font-semibold text-xs transition duration-200"
                              >
                                Ganti Gambar
                              </button>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-200 font-medium truncate max-w-xs mx-auto">{proofImage.name}</p>
                            <span className="text-[10px] text-slate-500 italic">Klik di mana saja atau drag file baru untuk mengganti</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 pointer-events-none">
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 mb-2">
                            <CloudUpload className="w-5.5 h-5.5" />
                          </div>
                          <p className="text-xs text-slate-300 font-medium">
                            Tarik dan letakkan berkas screenshot proof atau klik untuk memilih
                          </p>
                          <span className="text-[10px] text-slate-500 block">
                            Mendukung berkas format PNG, JPG, JPEG ukuran maks 10MB
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* FORM SUBMIT BUTTON PANEL */}
                  <div className="pt-2">
                    <button
                      id="btn-submit-verification-form"
                      type="submit"
                      disabled={submitStatus === "submitting" || !verifiedProfile || !proofImage}
                      className="w-full py-4 bg-gradient-to-tr from-rose-600 to-rose-500 disabled:from-slate-800 disabled:to-slate-800 text-white disabled:text-slate-500 font-display font-semibold rounded-2xl transition shadow-xl shadow-rose-950/10 cursor-pointer disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.99]"
                    >
                      {submitStatus === "submitting" ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          Sedang Mengirim Bukti...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-white" />
                          Kirim Verifikasi Ke Admin
                        </>
                      )}
                    </button>
                    {!verifiedProfile && (
                      <p className="text-[11px] text-rose-400 font-medium text-center mt-3 bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-500/10 select-none">
                        ⚠️ Selesaikan "Langkah 1: Verifikasi Akun Roblox" terlebih dahulu!
                      </p>
                    )}
                  </div>
                </form>
              )}
              </>
            )}
            </>
          )}
          </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 select-none mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-[11px] text-slate-500">
          <div>
            <p>&copy; 2026 RBX Portal. Portal Verifikasi Roblox Terpercaya.</p>
            <p className="mt-1 font-mono text-slate-700">Server Status: Port 3000 Ingress Operational</p>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-slate-300 cursor-pointer transition">Panduan Sistem</span>
            <span className="hover:text-slate-300 cursor-pointer transition">Kebijakan Privasi</span>
            <span className="hover:text-slate-300 cursor-pointer transition">Kontak Admin</span>
          </div>
        </div>
      </footer>

      {/* Lightbox Modal Dialog to view the Image Screen Evidence Full Size */}
      <AnimatePresence>
        {selectedProof && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-3xl w-full flex flex-col items-center justify-center p-2 relative"
            >
              <button
                id="btn-close-lightbox"
                onClick={() => setSelectedProof(null)}
                className="absolute -top-12 right-2 p-1.5 bg-slate-900 border border-slate-800 rounded-full text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="bg-slate-900/50 p-2 border border-slate-800 rounded-xl overflow-hidden max-h-[75vh] flex items-center justify-center shadow-2xl">
                <img
                  src={selectedProof}
                  alt="Proof Screenshot Zoomed"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>

              <div className="mt-4 text-center">
                <a
                  href={selectedProof}
                  download="evidence_proof.png"
                  className="px-4 py-2 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 rounded-xl font-medium transition"
                >
                  Unduh / Simpan Gambar Bukti
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
