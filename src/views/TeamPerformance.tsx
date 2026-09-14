import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';
import Modal from '@/components/Modal';
import {
  Users, Award, Key, Plus, RefreshCw, Trash2, Edit3, CheckCircle2,
  XCircle, Shield, ShoppingCart, Truck, Calendar, Clock,
  DollarSign, Package, AlertTriangle, ArrowUpRight, Copy, Check
} from 'lucide-react';

type UserItem = {
  id: string;
  username: string;
  full_name?: string | null;
  email: string;
  role: string;
  is_active: boolean;
};

type PerformanceSummary = {
  total_revenue: number;
  total_bills: number;
  total_weight_kg: number;
  total_weight_tons: number;
  total_dispatches: number;
  top_billing_staff: string;
  top_dispatch_staff: string;
};

type BillingStaffPerf = {
  staff_name: string;
  username: string;
  role: string;
  bills_count: number;
  total_revenue: number;
  cash_collected: number;
  credit_pending: number;
  discount_amount: number;
  average_bill: number;
  last_active: string | null;
};

type DispatchStaffPerf = {
  staff_name: string;
  username: string;
  role: string;
  dispatches_count: number;
  verified_count: number;
  completed_count: number;
  total_weight_kg: number;
  mismatch_count: number;
  last_active: string | null;
};

export default function TeamPerformance() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'members' | 'performance'>('members');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | 'billing' | 'dispatch' | 'admin'>('all');

  // Add Member Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'billing' | 'dispatch'>('billing');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Reset Password Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);

  // Edit Member Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'billing' | 'dispatch' | 'admin'>('billing');
  const [editIsActive, setEditIsActive] = useState(true);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Performance State
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [perfSummary, setPerfSummary] = useState<PerformanceSummary | null>(null);
  const [billingPerf, setBillingPerf] = useState<BillingStaffPerf[]>([]);
  const [dispatchPerf, setDispatchPerf] = useState<DispatchStaffPerf[]>([]);
  const [loadingPerf, setLoadingPerf] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data: UserItem[] = await api.get('/users');
      setUsers(data);
    } catch (e: any) {
      toast(e.message || 'Failed to fetch team members', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  // Fetch Performance
  const fetchPerformance = useCallback(async () => {
    setLoadingPerf(true);
    try {
      let url = `/dashboard/staff-performance?timeframe=${timeframe}`;
      if (timeframe === 'custom' && customStartDate) {
        url += `&start_date=${customStartDate}`;
        if (customEndDate) url += `&end_date=${customEndDate}`;
      }
      const data = await api.get(url);
      setPerfSummary(data.summary);
      setBillingPerf(data.billing_team || []);
      setDispatchPerf(data.dispatch_team || []);
    } catch (e: any) {
      toast(e.message || 'Failed to fetch staff performance', 'error');
    } finally {
      setLoadingPerf(false);
    }
  }, [timeframe, customStartDate, customEndDate, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (activeTab === 'performance') {
      fetchPerformance();
    }
  }, [activeTab, fetchPerformance]);

  const generateRandomPassword = (namePrefix = 'anbu') => {
    const clean = namePrefix.toLowerCase().replace(/[^a-z]/g, '') || 'staff';
    const randNum = Math.floor(100 + Math.random() * 900);
    return `${clean}@anbu${randNum}`;
  };

  const handleOpenAddModal = () => {
    setNewFullName('');
    setNewUsername('');
    setNewRole('billing');
    setNewPassword('billing@anbu123');
    setNewEmail('');
    setAddModalOpen(true);
  };

  const handleFullNameChange = (val: string) => {
    setNewFullName(val);
    const suggestedUsername = val.toLowerCase().trim().replace(/\s+/g, '');
    setNewUsername(suggestedUsername);
    setNewEmail(suggestedUsername ? `${suggestedUsername}@anbu.com` : '');
    setNewPassword(suggestedUsername ? `${suggestedUsername}@anbu123` : 'staff@anbu123');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      toast('Username is required', 'error');
      return;
    }
    if (!newPassword.trim() || newPassword.length < 4) {
      toast('Password must be at least 4 characters', 'error');
      return;
    }

    setSubmittingAdd(true);
    try {
      await api.post('/users', {
        username: newUsername.trim().toLowerCase(),
        full_name: newFullName.trim() || newUsername.trim(),
        role: newRole,
        password: newPassword.trim(),
        email: newEmail.trim() || `${newUsername.trim().toLowerCase()}@anbu.com`
      });
      toast(`Member ${newFullName || newUsername} added successfully!`, 'success');
      setAddModalOpen(false);
      fetchUsers();
    } catch (e: any) {
      toast(e.message || 'Failed to create user', 'error');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleOpenResetModal = (user: UserItem) => {
    setSelectedUser(user);
    const cleanUser = user.username.toLowerCase();
    setResetPasswordVal(`${cleanUser}@anbu123`);
    setResetModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!resetPasswordVal.trim() || resetPasswordVal.length < 4) {
      toast('Password must be at least 4 characters', 'error');
      return;
    }

    setSubmittingReset(true);
    try {
      await api.post(`/users/${selectedUser.id}/reset-password`, {
        new_password: resetPasswordVal.trim()
      });
      toast(`Password for ${selectedUser.full_name || selectedUser.username} updated!`, 'success');
      setResetModalOpen(false);
    } catch (e: any) {
      toast(e.message || 'Failed to reset password', 'error');
    } finally {
      setSubmittingReset(false);
    }
  };

  const handleOpenEditModal = (user: UserItem) => {
    setSelectedUser(user);
    setEditFullName(user.full_name || '');
    setEditRole((user.role.toLowerCase() as any) || 'billing');
    setEditIsActive(user.is_active);
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSubmittingEdit(true);
    try {
      await api.put(`/users/${selectedUser.id}`, {
        full_name: editFullName.trim(),
        role: editRole,
        is_active: editIsActive
      });
      toast('Member updated successfully', 'success');
      setEditModalOpen(false);
      fetchUsers();
    } catch (e: any) {
      toast(e.message || 'Failed to update member', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      await api.put(`/users/${user.id}`, {
        is_active: !user.is_active
      });
      toast(`${user.full_name || user.username} is now ${!user.is_active ? 'Active' : 'Disabled'}`, 'success');
      fetchUsers();
    } catch (e: any) {
      toast(e.message || 'Failed to change status', 'error');
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (user.username.toLowerCase() === 'admin' || user.id === currentUser?.id) {
      toast('Cannot delete main administrator account', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to delete user account "${user.full_name || user.username}"?`)) {
      return;
    }

    try {
      await api.delete(`/users/${user.id}`);
      toast(`User ${user.username} deleted`, 'success');
      fetchUsers();
    } catch (e: any) {
      toast(e.message || 'Failed to delete user', 'error');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter === 'all') return true;
    return (u.role || '').toLowerCase() === roleFilter.toLowerCase();
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Card */}
      <div className="glass-panel p-6 rounded-3xl border border-white/20 dark:border-slate-800 shadow-xl relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-sky-500/10 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Users size={24} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Team Management & Staff Performance
                </h1>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Assign individual credentials for Billing & Dispatch teams and track their revenue & dispatch output.
                </p>
              </div>
            </div>
          </div>

          {/* Primary View Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-inner">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition ${
                activeTab === 'members'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users size={16} className="text-amber-500" />
              <span>Team Members ({users.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition ${
                activeTab === 'performance'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Award size={16} className="text-indigo-500" />
              <span>Performance Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: TEAM MEMBERS MANAGEMENT */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'billing', 'dispatch', 'admin'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold capitalize transition whitespace-nowrap ${
                    roleFilter === role
                      ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-900 shadow-md'
                      : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {role === 'all' ? 'All Roles' : `${role} Team`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
                title="Refresh user list"
              >
                <RefreshCw size={14} className={loadingUsers ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleOpenAddModal}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md font-extrabold"
              >
                <Plus size={16} />
                <span>Add Team Member</span>
              </button>
            </div>
          </div>

          {/* Members Grid */}
          {loadingUsers && users.length === 0 ? (
            <div className="flex justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map(u => {
                const roleLower = (u.role || '').toLowerCase();
                const isBilling = roleLower === 'billing' || roleLower === 'cashier';
                const isDispatch = roleLower === 'dispatch';
                const isAdmin = roleLower === 'admin';

                const badgeBg = isBilling
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : isDispatch
                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-800';

                const avatarLetter = (u.full_name || u.username).charAt(0).toUpperCase();

                return (
                  <div
                    key={u.id}
                    className={`glass-panel rounded-2xl p-5 border transition hover:shadow-lg flex flex-col justify-between ${
                      !u.is_active
                        ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-800'
                        : 'border-white/20 dark:border-slate-800/80 bg-white/70 dark:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${
                              isBilling
                                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                                : isDispatch
                                ? 'bg-gradient-to-br from-sky-400 to-sky-600 text-white'
                                : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                            }`}
                          >
                            {avatarLetter}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                              {u.full_name || u.username.title()}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              <span>@{u.username}</span>
                              <button
                                onClick={() => copyToClipboard(u.username, u.id)}
                                className="hover:text-amber-600 transition"
                                title="Copy username"
                              >
                                {copiedId === u.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full border ${badgeBg}`}>
                          {u.role}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                          <span className="text-slate-400">Email:</span>
                          <span className="font-medium truncate max-w-[180px]">{u.email}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                          <span className="text-slate-400">Status:</span>
                          <span className="flex items-center gap-1 font-bold">
                            {u.is_active ? (
                              <>
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="text-emerald-700 dark:text-emerald-400">Active</span>
                              </>
                            ) : (
                              <>
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                <span className="text-rose-600 dark:text-rose-400">Disabled</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                          u.is_active
                            ? 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50'
                            : 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenResetModal(u)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="Reset Password"
                        >
                          <Key size={16} className="text-amber-600 dark:text-amber-400" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title="Edit Member"
                        >
                          <Edit3 size={16} />
                        </button>
                        {u.username.toLowerCase() !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Delete Member"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PERFORMANCE ANALYTICS */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-white/20 dark:border-slate-800 bg-white/70 dark:bg-slate-800/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {(['today', 'week', 'month', 'all', 'custom'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold capitalize transition whitespace-nowrap ${
                    timeframe === tf
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {tf === 'today' ? "Today's Work" : tf === 'week' ? 'This Week (7 Days)' : tf === 'month' ? 'This Month (30 Days)' : tf === 'all' ? 'All Time' : 'Custom Range'}
                </button>
              ))}
            </div>

            {timeframe === 'custom' && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="input py-1 px-2.5 text-xs"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="input py-1 px-2.5 text-xs"
                />
              </div>
            )}

            <button
              onClick={fetchPerformance}
              disabled={loadingPerf}
              className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 self-start md:self-auto"
            >
              <RefreshCw size={14} className={loadingPerf ? 'animate-spin' : ''} />
              <span>Refresh Metrics</span>
            </button>
          </div>

          {/* KPI Summary Cards */}
          {perfSummary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Total Billed Revenue
                  </span>
                  <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-600">
                    <DollarSign size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <h2 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">
                    ₹{perfSummary.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h2>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                    {perfSummary.total_bills} bills generated
                  </p>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-sky-500/20 bg-sky-50/40 dark:bg-sky-950/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-sky-800 dark:text-sky-300 uppercase tracking-wider">
                    Total Material Dispatched
                  </span>
                  <div className="p-2 bg-sky-500/20 rounded-xl text-sky-600">
                    <Package size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <h2 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">
                    {perfSummary.total_weight_tons} <span className="text-lg font-bold">Tons</span>
                  </h2>
                  <p className="text-xs font-semibold text-sky-700 dark:text-sky-400 mt-1">
                    {perfSummary.total_weight_kg.toLocaleString('en-IN')} kg verified
                  </p>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    Top Billing Performer
                  </span>
                  <div className="p-2 bg-amber-500/20 rounded-xl text-amber-600">
                    <Award size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white truncate">
                    {perfSummary.top_billing_staff}
                  </h2>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-1">
                    Highest Billing Revenue
                  </p>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
                    Top Dispatch Performer
                  </span>
                  <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-600">
                    <Truck size={18} />
                  </div>
                </div>
                <div className="mt-3">
                  <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white truncate">
                    {perfSummary.top_dispatch_staff}
                  </h2>
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 mt-1">
                    Most Dispatches Completed
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Billing Team Performance */}
          <div className="glass-panel rounded-3xl border border-white/20 dark:border-slate-800 bg-white/70 dark:bg-slate-800/60 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Billing Team Performance
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Breakdown of bills created, payment collected, and credit created per cashier.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4 text-center">Bills Created</th>
                    <th className="py-3 px-4 text-right">Total Billed (₹)</th>
                    <th className="py-3 px-4 text-right">Cash / Paid (₹)</th>
                    <th className="py-3 px-4 text-right">Credit / Dues (₹)</th>
                    <th className="py-3 px-4 text-right">Avg Bill Value (₹)</th>
                    <th className="py-3 px-4 text-right">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs">
                  {billingPerf.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No billing activity recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    billingPerf.map(b => (
                      <tr key={b.username} className="hover:bg-amber-50/30 dark:hover:bg-slate-700/30 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black text-xs">
                            {b.staff_name.charAt(0)}
                          </div>
                          <div>
                            <div>{b.staff_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">@{b.username}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-800 dark:text-slate-200">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700">
                            {b.bills_count}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 dark:text-white">
                          ₹{b.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{b.cash_collected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                          ₹{b.credit_pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-700 dark:text-slate-300">
                          ₹{b.average_bill.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                          {b.last_active ? new Date(b.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Dispatch Team Performance */}
          <div className="glass-panel rounded-3xl border border-white/20 dark:border-slate-800 bg-white/70 dark:bg-slate-800/60 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-600">
                  <Truck size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Dispatch Team Performance
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Breakdown of material verified, completed dispatches, and weight handled per dispatcher.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4 text-center">Dispatches Verified</th>
                    <th className="py-3 px-4 text-center">Completed Deliveries</th>
                    <th className="py-3 px-4 text-right">Total Weight (kg)</th>
                    <th className="py-3 px-4 text-right">Tonnage (Tons)</th>
                    <th className="py-3 px-4 text-center">Weight Mismatches</th>
                    <th className="py-3 px-4 text-right">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs">
                  {dispatchPerf.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No dispatch activity recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    dispatchPerf.map(d => (
                      <tr key={d.username} className="hover:bg-sky-50/30 dark:hover:bg-slate-700/30 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center font-black text-xs">
                            {d.staff_name.charAt(0)}
                          </div>
                          <div>
                            <div>{d.staff_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">@{d.username}</div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-800 dark:text-slate-200">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700">
                            {d.verified_count}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-emerald-600 dark:text-emerald-400">
                          {d.completed_count}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 dark:text-white">
                          {d.total_weight_kg.toLocaleString('en-IN')} kg
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-sky-600 dark:text-sky-400">
                          {(d.total_weight_kg / 1000).toFixed(2)} Tons
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {d.mismatch_count > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {d.mismatch_count} mismatches
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                          {d.last_active ? new Date(d.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New Team Member */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="➕ Add New Team Member" size="md">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              required
              className="input"
              placeholder="e.g. Sundar, Praveen, Arun"
              value={newFullName}
              onChange={e => handleFullNameChange(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Login ID / Username</label>
              <input
                type="text"
                required
                className="input font-mono"
                placeholder="e.g. sundar"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
              />
            </div>
            <div>
              <label className="label">Assigned Team / Role</label>
              <select
                className="input font-bold"
                value={newRole}
                onChange={e => setNewRole(e.target.value as any)}
              >
                <option value="billing">Billing Team</option>
                <option value="dispatch">Dispatch Team</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label">Login Password</label>
              <button
                type="button"
                onClick={() => setNewPassword(generateRandomPassword(newUsername || 'anbu'))}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Auto-Generate
              </button>
            </div>
            <input
              type="text"
              required
              className="input font-mono font-bold text-amber-700 dark:text-amber-400"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Share this password with the staff member. They will use this along with their username to log in.
            </p>
          </div>

          <div>
            <label className="label">Email Address (Optional)</label>
            <input
              type="email"
              className="input"
              placeholder={`${newUsername || 'staff'}@anbu.com`}
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingAdd}
              className="btn-primary bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {submittingAdd ? 'Saving...' : 'Add Team Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Reset Password */}
      <Modal open={resetModalOpen} onClose={() => setResetModalOpen(false)} title="🔑 Reset Member Password" size="sm">
        {selectedUser && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs space-y-1">
              <div className="font-bold text-amber-900 dark:text-amber-300">
                {selectedUser.full_name || selectedUser.username}
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                Username: @{selectedUser.username} ({selectedUser.role.toUpperCase()})
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label">New Password</label>
                <button
                  type="button"
                  onClick={() => setResetPasswordVal(generateRandomPassword(selectedUser.username))}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Auto-Generate
                </button>
              </div>
              <input
                type="text"
                required
                className="input font-mono font-bold text-amber-700 dark:text-amber-400"
                value={resetPasswordVal}
                onChange={e => setResetPasswordVal(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReset}
                className="btn-primary bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {submittingReset ? 'Updating...' : 'Set New Password'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: Edit Member */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="✏️ Edit Team Member" size="sm">
        {selectedUser && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                required
                className="input"
                value={editFullName}
                onChange={e => setEditFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Team / Role</label>
              <select
                className="input font-bold"
                value={editRole}
                onChange={e => setEditRole(e.target.value as any)}
                disabled={selectedUser.username.toLowerCase() === 'admin'}
              >
                <option value="billing">Billing Team</option>
                <option value="dispatch">Dispatch Team</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="editIsActiveCheckbox"
                checked={editIsActive}
                onChange={e => setEditIsActive(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="editIsActiveCheckbox" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Account is Active (Allow Login)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="btn-primary"
              >
                {submittingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
