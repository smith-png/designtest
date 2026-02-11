import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { teamsAPI, playerAPI, auctionAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import './AuctionStats.css';

export default function AuctionStats() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Data State
    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myTeam, setMyTeam] = useState(null);

    // UI State
    const [activeSport, setActiveSport] = useState('Cricket'); // Default filter
    const [showSidebar, setShowSidebar] = useState(false);

    useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);

    const fetchData = async () => {
        try {
            const [teamsRes, playersRes] = await Promise.all([
                teamsAPI.getAllTeams(),
                playerAPI.getAllPlayers()
            ]);
            setTeams(teamsRes.data.teams);
            setPlayers(playersRes.data.players);

            // If Owner, find their specific team (Robust Matching from previous fix)
            if (user?.role === 'team_owner') {
                const foundTeam = teamsRes.data.teams.find(t =>
                    t.owner_name?.trim().toLowerCase() === user.name?.trim().toLowerCase()
                );
                setMyTeam(foundTeam);
            }
        } catch (err) { console.error("Stats Load Failed", err); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (user) fetchData(); }, [user]);

    // Actions
    const handleRelease = async (player) => {
        if (!window.confirm(`Release ${player.name}? This will refund the team.`)) return;
        try {
            await auctionAPI.markPlayerUnsold(player.id);
            fetchData();
        } catch (err) { alert("Failed to release."); console.error(err); }
    };

    if (!user) return null;
    if (loading) return <div className="stats-loading">LOADING DATA...</div>;

    // --- TEAM OWNER VIEW (PORTFOLIO) ---
    if (user.role === 'team_owner') {
        if (!myTeam) return (
            <div className="stats-error" style={{ flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
                <div>TEAM NOT LINKED.</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>CURRENT USER: {user.name}</div>
                <div>CONTACT ADMIN.</div>
            </div>
        );

        const myPlayers = players.filter(p => p.team_id === myTeam.id);
        const budgetUsed = (myTeam.total_purse || 2000) - (myTeam.purse_remaining || 0);
        const burnRate = myTeam.total_purse ? (budgetUsed / myTeam.total_purse) * 100 : 0;

        return (
            <div className="stats-page">
                <div className="stats-header-row">
                    <div>
                        <div className="meta-tag">PORTFOLIO /// {myTeam.name.toUpperCase()}</div>
                        <h1 className="page-title">TEAM REPORT</h1>
                    </div>
                </div>

                {/* KPI GRID (Restored for Owner) */}
                <div className="kpi-grid">
                    <div className="kpi-card">
                        <span className="kpi-label">CAP SPACE REMAINING</span>
                        <span className="kpi-value highlight">{(myTeam.purse_remaining || 0).toLocaleString()} PTS</span>
                        <div className="kpi-bar-bg"><div className="kpi-bar-fill" style={{ width: `${Math.max(0, 100 - burnRate)}%` }}></div></div>
                    </div>
                    <div className="kpi-card">
                        <span className="kpi-label">TOTAL INVESTED</span>
                        <span className="kpi-value">{budgetUsed.toLocaleString()} PTS</span>
                    </div>
                    <div className="kpi-card">
                        <span className="kpi-label">ROSTER SIZE</span>
                        <span className="kpi-value">{myPlayers.length} ATHLETES</span>
                    </div>
                </div>

                {/* MY ROSTER TABLE */}
                <div className="ledger-container">
                    <div className="ledger-title">CURRENT HOLDINGS</div>
                    {myPlayers.length === 0 ? (
                        <div className="empty-ledger">NO ASSETS ACQUIRED YET.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="editorial-table">
                                <thead>
                                    <tr>
                                        <th>NAME</th>
                                        <th>DISCIPLINE</th>
                                        <th>CLASS</th>
                                        <th>ACQUISITION COST</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myPlayers.map(p => (
                                        <tr key={p.id}>
                                            <td className="bold">{p.name}</td>
                                            <td>{p.sport}</td>
                                            <td className="mono">{p.year}</td>
                                            <td className="mono highlight">{p.sold_price?.toLocaleString() || 0}</td>
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

    // --- ADMIN VIEW (SIDEBAR + FILTERS) ---
    if (user.role === 'admin') {
        // Filter Players by Sport AND Sold Status
        const soldPlayers = players.filter(p =>
            p.status === 'sold' &&
            p.sport?.toLowerCase() === activeSport.toLowerCase()
        ).sort((a, b) => (b.sold_price || 0) - (a.sold_price || 0));

        // Filter Teams by Sport
        const teamsWithRosters = teams.map(team => {
            const teamRoster = players.filter(p => p.team_id === team.id && p.sport?.toLowerCase() === activeSport.toLowerCase() && p.status === 'sold');
            return { ...team, roster: teamRoster };
        }).filter(t => t.sport?.toLowerCase() === activeSport.toLowerCase() || t.roster.length > 0);

        return (
            <div className="stats-page">
                {/* HEADER WITH FILTERS */}
                <div className="stats-header-row">
                    <div>
                        <div className="meta-tag">ADMINISTRATION</div>
                        <h1 className="page-title">AUCTION STATS</h1>
                    </div>
                    <div className="header-actions">
                        <div className="sport-filter-group">
                            {['Cricket', 'Futsal', 'Volleyball'].map(sport => (
                                <button
                                    key={sport}
                                    className={`filter-btn ${activeSport === sport ? 'active' : ''}`}
                                    onClick={() => setActiveSport(sport)}
                                >
                                    {sport.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <button className="sidebar-toggle" onClick={() => setShowSidebar(true)}>
                            VIEW TEAMS →
                        </button>
                    </div>
                </div>

                {/* MAIN LEDGER (Center Stage) */}
                <div className="ledger-container">
                    <div className="ledger-title">{activeSport} TRANSACTION LOG</div>
                    <div className="table-responsive">
                        <table className="editorial-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>ATHLETE</th>
                                    <th>ACQUIRED BY</th>
                                    <th>PRICE</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {soldPlayers.length === 0 ? (
                                    <tr><td colSpan="5" className="empty-cell">NO TRANSACTIONS RECORDED FOR {activeSport}</td></tr>
                                ) : (
                                    soldPlayers.map(p => {
                                        const team = teams.find(t => t.id === p.team_id);
                                        return (
                                            <tr key={p.id}>
                                                <td className="mono">#{p.id}</td>
                                                <td className="bold">{p.name}</td>
                                                <td>{team?.name || 'UNKNOWN'}</td>
                                                <td className="mono highlight">{p.sold_price?.toLocaleString()}</td>
                                                <td>
                                                    <button className="btn-release" onClick={() => handleRelease(p)}>RELEASE</button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SIDEBAR (TEAMS DRAWER) */}
                <div className={`stats-sidebar-overlay ${showSidebar ? 'open' : ''}`} onClick={() => setShowSidebar(false)}>
                    <div className="stats-sidebar" onClick={e => e.stopPropagation()}>
                        <div className="sidebar-header">
                            <h2>{activeSport} TEAMS</h2>
                            <button className="close-btn" onClick={() => setShowSidebar(false)}>✕</button>
                        </div>
                        <div className="sidebar-content">
                            {teamsWithRosters.length === 0 ? (
                                <div className="empty-sidebar">NO TEAMS FOUND</div>
                            ) : (
                                teamsWithRosters.map(team => (
                                    <div key={team.id} className="sidebar-team-card">
                                        <div className="sidebar-team-header">
                                            <span className="sidebar-team-name">{team.name}</span>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="sidebar-team-budget">{team.purse_remaining?.toLocaleString()} LEFT</div>
                                                <div style={{ fontSize: '0.6rem', color: '#555' }}>CAP: {team.total_purse}</div>
                                            </div>
                                        </div>
                                        <div className="sidebar-roster-list">
                                            {team.roster.length === 0 ? (
                                                <div className="empty-roster">NO PLAYERS ACQUIRED</div>
                                            ) : (
                                                team.roster.map(p => (
                                                    <div key={p.id} className="sidebar-player-row">
                                                        <span>{p.name}</span>
                                                        <span className="sidebar-price">{p.sold_price?.toLocaleString()}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
