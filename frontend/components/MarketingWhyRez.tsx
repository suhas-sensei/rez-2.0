import { BackgroundRippleEffect } from './ui/background-ripple-effect';
import { SpotlightCard } from './ui/spotlight-card';

const WhyRez = () => {
    return (
        <section className="why-rez relative overflow-hidden" id="why-rez">
            <BackgroundRippleEffect />
            <div className="content-wrapper relative z-10">
                <h2>Why Rez ?</h2>
                <div className="why-rez-grid">
                    <SpotlightCard className="feature-box group">
                        <div className="relative z-10">
                            <div className="card-image-wrapper">
                                <img src="/oneclick.jpg" alt="One-click setup" className="card-image" />
                            </div>
                            <h3>One-click setup</h3>
                            <p>Deposit, select risk, and go. Institutional-grade trading made accessible to everyone.</p>
                        </div>
                    </SpotlightCard>
                    <SpotlightCard className="feature-box group">
                        <div className="relative z-10">
                            <div className="card-image-wrapper">
                                <img src="/trueautonomy.jpg" alt="True autonomy" className="card-image" />
                            </div>
                            <h3>True autonomy</h3>
                            <p>Advanced AI pipelines optimizing strategies in real-time, while you sleep.</p>
                        </div>
                    </SpotlightCard>
                    <SpotlightCard className="feature-box group">
                        <div className="relative z-10">
                            <div className="card-image-wrapper">
                                <img src="/noncustodial.jpg" alt="Non-custodial" className="card-image" />
                            </div>
                            <h3>Non-custodial</h3>
                            <p>Transparent on-chain execution with self custody.</p>
                        </div>
                    </SpotlightCard>
                </div>
            </div>
        </section>
    );
};

export default WhyRez;
