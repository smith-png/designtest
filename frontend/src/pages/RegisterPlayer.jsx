import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerAPI } from '../services/api';
import './RegisterPlayer.css';

export default function RegisterPlayer() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        sport: 'Cricket',
        year: 'FE',
        base_price: 500, // Default fallback
        photo_url: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await playerAPI.registerPlayer(formData);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-page">
            <div className="register-container">
                <div className="register-header">
                    <span className="meta-tag">NEW TALENT ENTRY</span>
                    <h1 className="page-title">PLAYER REGISTRATION</h1>
                </div>

                {error && <div className="error-banner">ERROR: {error}</div>}

                <form onSubmit={handleSubmit} className="editorial-form">
                    <div className="form-group">
                        <label>FULL NAME</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="ENTER NAME..." className="editorial-input" />
                    </div>

                    <div className="form-group">
                        <label>EMAIL ADDRESS</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="COLLEGE EMAIL..." className="editorial-input" />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>DISCIPLINE</label>
                            <select name="sport" value={formData.sport} onChange={handleChange} className="editorial-select">
                                <option value="Cricket">CRICKET</option>
                                <option value="Futsal">FUTSAL</option>
                                <option value="Volleyball">VOLLEYBALL</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>ACADEMIC YEAR</label>
                            <select name="year" value={formData.year} onChange={handleChange} className="editorial-select">
                                <option value="FE">1ST YEAR (FE)</option>
                                <option value="SE">2ND YEAR (SE)</option>
                                <option value="TE">3RD YEAR (TE)</option>
                                <option value="BE">4TH YEAR (BE)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>PHOTO URL</label>
                        <input type="url" name="photo_url" value={formData.photo_url} onChange={handleChange} placeholder="HTTPS://..." className="editorial-input" />
                        <div className="input-hint">Provide a direct link to a hosted image</div>
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? 'PROCESSING...' : 'SUBMIT APPLICATION'}
                    </button>
                </form>
            </div>
        </div>
    );
}
