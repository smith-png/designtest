import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { teamsAPI, playerAPI, adminAPI } from '../services/api';
import './Admin.css';

export default function Admin() {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState({ pending: 0, teams: 0, players: 0 });
    const [allPlayers, setAllPlayers] = useState([]);

    useEffect(() => { if (!isAdmin) navigate('/'); }, [isAdmin, navigate]);

    const loadData = async () => {
        try {
            const [pRes, tRes] = await Promise.all([playerAPI.getAllPlayers(), teamsAPI.getAllTeams()]);
            setAllPlayers(pRes.data.players);
            setStats({
                pending: pRes.data.players.filter(p => p.status === 'pending').length,
                players: pRes.data.players.length,
                teams: tRes.data.teams.length
            });
        } catch (err) { console.error(err); }
    };

    useEffect(() => { if (isAdmin) loadData(); }, [isAdmin]);

    const handleApprove = async (id) => {
        if (!window.confirm("Approve player?")) return;
        try { await adminAPI.approvePlayer(id); loadData(); } catch (e) { console.error(e); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete player?")) return;
        try { await adminAPI.deletePlayer(id); loadData(); } catch (e) { console.error(e); }
    };

    if (!isAdmin) return null;

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div className="meta-tag">ADMINISTRATION DASHBOARD</div>
                <h1 className="page-title">LEAGUE CONTROL</h1>
            </div>

            {/* TAB NAV */}
            <div className="admin-tabs">
                <button className={`admin-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>OVERVIEW</button>
                <button className={`admin-tab-btn ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>PLAYERS</button>
            </div>

            {/* CONTENT */}
            <div className="admin-content">

                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <div className="kpi-grid">
                        <div className="kpi-card">
                            <span className="kpi-label">PENDING APPROVALS</span>
                            <span className="kpi-value highlight">{stats.pending}</span>
                        </div>
                        <div className="kpi-card">
                            <span className="kpi-label">TOTAL TEAMS</span>
                            <span className="kpi-value">{stats.teams}</span>
                        </div>
                        <div className="kpi-card">
                            <span className="kpi-label">TOTAL PLAYERS</span>
                            <span className="kpi-value">{stats.players}</span>
                        </div>
                    </div>
                )}

                {/* PLAYERS TAB */}
                {activeTab === 'players' && (
                    <div className="table-responsive">
                        <table className="editorial-table">
                            <thead>
                                <tr>
                                    <th>NAME</th>
                                    <th>SPORT</th>
                                    <th>STATUS</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allPlayers.map(p => (
                                    <tr key={p.id}>
                                        <td className="bold">{p.name}</td>
                                        <td>{p.sport}</td>
                                        <td><span className={`status-badge ${p.status}`}>{p.status.toUpperCase()}</span></td>
                                        <td>
                                            <div className="action-row">
                                                {p.status === 'pending' && (
                                                    <button className="action-btn approve" onClick={() => handleApprove(p.id)}>APPROVE</button>
                                                )}
                                                <button className="action-btn delete" onClick={() => handleDelete(p.id)}>DELETE</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
