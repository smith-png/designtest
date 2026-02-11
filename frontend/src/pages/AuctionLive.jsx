import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { auctionAPI, playerAPI, teamsAPI } from '../services/api';
import socketService from '../services/socket';
import Confetti from 'react-confetti';
import useSound from 'use-sound';
import './AuctionLive.css';

const BID_SFX = 'https://assets.mixkit.co/sfx/preview/mixkit-sci-fi-click-900.mp3';
const SOLD_SFX = 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3';

export default function AuctionLive() {
    const { user, isAdmin, isTeamOwner } = useAuth();

    // Core State
    const [auction, setAuction] = useState(null);
    const [bids, setBids] = useState([]);
    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]); // This is the Queue
    const [isConnected, setIsConnected] = useState(false);

    // UI State
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [customBid, setCustomBid] = useState('');
    const [error, setError] = useState('');
    const [soldAnimation, setSoldAnimation] = useState(null);
    const [proxyTeamId, setProxyTeamId] = useState('');
    const [proxyBidAmount, setProxyBidAmount] = useState('');

    const scrollRef = useRef(null);
    const [playBid] = useSound(BID_SFX, { volume: 0.5 });
    const [playSold] = useSound(SOLD_SFX, { volume: 0.5 });

    useEffect(() => {
        const init = async () => {
            try {
                const [teamsRes, playersRes] = await Promise.all([
                    teamsAPI.getAllTeams(),
                    playerAPI.getAllPlayers()
                ]);
                setTeams(teamsRes.data.teams);
                // Filter only eligible players for the queue
                setPlayers(playersRes.data.players.filter(p => p.status === 'approved' || p.status === 'eligible'));
                await loadCurrentAuction();
            } catch (err) { console.error("Init Error", err); }
        };
        init();
        setupSocket();
        return () => socketService.disconnect();
    }, []);

    // Scroll effect removed since log window is gone, but keeping ref doesn't hurt

    const setupSocket = () => {
        const socket = socketService.connect();

        if (socket.connected) {
            setIsConnected(true);
            socketService.joinAuction();
        }

        socket.on('connect', () => {
            setIsConnected(true);
            socketService.joinAuction();
        });

        socket.on('disconnect', () => setIsConnected(false));

        socketService.onAuctionUpdate((data) => {
            if (data.type === 'started') {
                setAuction(data.player);
                setBids([]);
                setSoldAnimation(null);
                // Remove started player from queue locally
                setPlayers(prev => prev.filter(p => p.id !== data.player.id));
            } else if (data.type === 'sold') {
                setSoldAnimation(data);
                playSold();
                setTimeout(() => setAuction(null), 5000);
            } else if (data.type === 'unsold' || data.type === 'skipped') {
                setAuction(null);
                setBids([]);
            }
        });

        socketService.onBidUpdate((bid) => {
            if (bid.type === 'reset') {
                setBids(bid.amount ? [bid] : []);
            } else {
                playBid();
                setBids(prev => [...prev, bid]);
            }
        });
    };

    const loadCurrentAuction = async () => {
        try {
            const res = await auctionAPI.getCurrentAuction();
            if (res.data.currentAuction) {
                setAuction(res.data.currentAuction.player);
                if (res.data.currentAuction.highestBid) setBids([res.data.currentAuction.highestBid]);
            }
        } catch (err) { console.error(err); }
    };

    // --- ACTIONS ---
    const handleStart = async (targetId) => {
        const idToStart = targetId || selectedPlayerId;
        if (!idToStart) return setError("Select a player first");

        try { await auctionAPI.startAuction(idToStart); }
        catch (err) { setError('Start Failed: ' + (err.response?.data?.error || err.message)); }
    };

    const handleRemoveFromQueue = async (id) => {
        if (!window.confirm("Remove this player from the queue?")) return;
        try {
            await auctionAPI.skipPlayer(id);
            setPlayers(prev => prev.filter(p => p.id !== id)); // Remove locally
        }
        catch (err) { setError('Remove Failed'); }
    };

    const handleSold = async () => {
        if (!auction) return;
        const lastBid = bids[bids.length - 1];
        if (!lastBid) return setError("No bids placed");
        try { await auctionAPI.markPlayerSold(auction.id, lastBid.team_id || lastBid.teamId, lastBid.amount); }
        catch (err) { setError('Sell Failed'); }
    };

    const handleUnsold = async () => {
        if (!auction) return;
        try { await auctionAPI.markPlayerUnsold(auction.id); }
        catch (err) { setError('Unsold Failed'); }
    };

    const handleSkip = async () => {
        if (!auction) return;
        try { await auctionAPI.skipPlayer(auction.id); }
        catch (err) { setError('Skip Failed'); }
    };

    const handleReset = async () => {
        if (!auction) return;
        if (!window.confirm("Wipe all bids?")) return;
        try { await auctionAPI.resetCurrentBid(auction.id); }
        catch (err) { setError('Reset Failed'); }
    };

    const handleBid = async (amount) => {
        if (!auction) return;
        try {
            const myTeam = teams.find(t => t.owner_name?.toLowerCase() === user.name?.toLowerCase());
            if (!myTeam) return setError('Your team was not found');
            await auctionAPI.placeBid(auction.id, myTeam.id, amount);
            setCustomBid('');
        } catch (err) { setError(err.response?.data?.error || 'Bid Failed'); }
    };

    const handleProxyBid = async () => {
        if (!auction || !proxyTeamId || !proxyBidAmount) return setError("Select Team and Amount");
        try {
            await auctionAPI.placeBid(auction.id, proxyTeamId, parseInt(proxyBidAmount));
            setProxyBidAmount('');
        } catch (err) { setError('Manual Bid Failed'); }
    };

    const currentPrice = bids.length > 0 ? bids[bids.length - 1].amount : (auction?.base_price || 0);
    const nextBid = parseInt(currentPrice) + 100;

    return (
        <div className="auction-terminal">
            {soldAnimation && <Confetti recycle={false} numberOfPieces={500} colors={['#B8E0C0', '#ffffff', '#000000']} />}

            {/* VISUAL PANEL (LEFT) */}
            <div className={`visual-panel ${!auction ? 'standby-mode' : ''}`}>
                {auction ? (
                    /* LIVE VIEW (CLEAN - NO QUEUE) */
                    <>
                        <div className="live-indicator"><div className="blink-dot"></div> LIVE FEED</div>
                        {auction.photo_url ? <img src={auction.photo_url} className="hero-image" /> : <div className="hero-placeholder">{auction.name[0]}</div>}
                        <div className="hero-overlay">
                            <h1 className="hero-name">{auction.player_name || auction.name}</h1>
                            <div className="hero-meta"><span>{auction.year}</span><span>///</span><span>{auction.sport}</span><span>///</span><span>{auction.stats?.role || 'PLAYER'}</span></div>
                        </div>
                        {soldAnimation && (
                            <div className="sold-overlay">
                                <div className="sold-stamp">SOLD</div>
                                <div className="sold-details">TO {soldAnimation.teamName}<br />FOR {soldAnimation.amount} PTS</div>
                            </div>
                        )}
                    </>
                ) : (
                    /* STANDBY VIEW (SELECTION DECK) */
                    <div className="standby-selection-deck">
                        <div className="deck-title">
                            <span className="blink-text">/// TERMINAL READY</span>
                            <h2>UPCOMING LOTS</h2>
                        </div>

                        {players.length === 0 ? (
                            <div className="empty-queue-msg">ALL PLAYERS AUCTIONED</div>
                        ) : (
                            <div className="standby-grid">
                                {players.slice(0, 8).map(p => (
                                    <div key={p.id} className="standby-card" onClick={() => isAdmin && handleStart(p.id)}>

                                        {/* Image Section */}
                                        <div className="standby-img-wrapper">
                                            {p.photo_url ? (
                                                <img src={p.photo_url} className="standby-img" alt={p.name} />
                                            ) : (
                                                <div className="standby-placeholder">{p.name[0]}</div>
                                            )}

                                            {/* Hover Overlay */}
                                            {isAdmin && (
                                                <div className="standby-hover-overlay">
                                                    <span className="start-label">INITIATE</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info Section */}
                                        <div className="standby-info">
                                            <div className="standby-name">{p.name}</div>
                                            <div className="standby-meta">{p.sport} • {p.year}</div>
                                        </div>

                                        {/* Remove Button */}
                                        {isAdmin && (
                                            <button
                                                className="remove-queue-btn"
                                                onClick={(e) => { e.stopPropagation(); handleRemoveFromQueue(p.id); }}
                                                title="Remove from Queue"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* CONTROL PANEL (RIGHT) */}
            <div className="control-panel">
                <div className="panel-header">
                    <div className="connection-status">STATUS: <span style={{ color: isConnected ? '#B8E0C0' : '#FF3333' }}>{isConnected ? 'ONLINE' : 'OFFLINE'}</span></div>
                    {error && <div className="panel-error">{error}</div>}
                </div>

                {/* BIG NUMBER DISPLAY (Enhanced) */}
                <div className="bid-display-huge">
                    <span className="label">CURRENT VALUATION</span>
                    <div className="huge-number">{currentPrice.toLocaleString()}</div>

                    {/* Replaced Log with a prominent "Leader" Box */}
                    <div className="current-leader-box">
                        <span className="leader-label">CURRENTLY HELD BY</span>
                        <div className="leader-name">
                            {bids.length > 0
                                ? (bids[bids.length - 1].team_name || bids[bids.length - 1].teamName)
                                : 'NO BIDS YET'}
                        </div>
                    </div>
                </div>

                {/* ACTION ZONE (Pushed to bottom) */}
                <div className="action-zone">
                    {isAdmin && (
                        <div className="admin-command-deck">
                            <div className="deck-header">AUCTIONEER COMMAND</div>
                            {!auction ? (
                                <div className="start-box">
                                    <select onChange={e => setSelectedPlayerId(e.target.value)} value={selectedPlayerId} className="admin-select">
                                        <option value="">SELECT PLAYER TO START...</option>
                                        {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sport})</option>)}
                                    </select>
                                    <button onClick={() => handleStart(selectedPlayerId)} className="btn-sage">INITIATE</button>
                                </div>
                            ) : (
                                <>
                                    <div className="proxy-bid-row">
                                        <select className="admin-select-small" value={proxyTeamId} onChange={e => setProxyTeamId(e.target.value)}>
                                            <option value="">SELECT TEAM...</option>
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                        <input type="number" className="admin-input-small" placeholder="AMOUNT" value={proxyBidAmount} onChange={e => setProxyBidAmount(e.target.value)} />
                                        <button onClick={handleProxyBid} className="btn-proxy">FORCE BID</button>
                                    </div>
                                    <div className="deck-grid">
                                        <button onClick={handleSold} className="deck-btn btn-sold">SOLD</button>
                                        <button onClick={handleUnsold} className="deck-btn btn-unsold">UNSOLD</button>
                                        <button onClick={handleSkip} className="deck-btn btn-skip">SKIP</button>
                                        <button onClick={handleReset} className="deck-btn btn-reset">RESET</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {isTeamOwner && auction && (
                        <div className="bidder-grid">
                            <button onClick={() => handleBid(nextBid)} className="btn-sage-large">BID {nextBid}</button>
                            <div className="custom-bid-row">
                                <input type="number" placeholder="CUSTOM..." value={customBid} onChange={e => setCustomBid(e.target.value)} className="bid-input" />
                                <button onClick={() => handleBid(customBid)} className="btn-outline">→</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
