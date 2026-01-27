import React from 'react';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-top">
                    <div className="footer-info">
                        <div className="footer-brand">
                            <img src="/rez1.png" alt="Rez Logo" className="footer-logo" />
                            <h3>Rez</h3>
                        </div>
                        <p className="footer-description">
                            The intelligence layer for perpetuals
                        </p>
                    </div>

                    <div className="footer-nav-group">
                        <div className="footer-column">
                            <h4>Socials</h4>
                            <a href="https://x.com/LabsRez" className="footer-link" target="_blank" rel="noopener noreferrer">Twitter</a>
                            <a href="#" className="footer-link">GitHub</a>
                        </div>
                        <div className="footer-column">
                            <h4>Legal</h4>
                            <a href="#" className="footer-link">Privacy Policy</a>
                            <a href="#" className="footer-link">Terms of Service</a>
                            <a href="#" className="footer-link">Cookie Policy</a>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; {currentYear} RezLabs. All rights reserved.</p>
                    <p className="footer-credit">Designed for the future.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
