import { HoleBackground } from './animate-ui/components/backgrounds/hole';

const Mission = () => {
    return (
        <section className="manifesto relative overflow-hidden dark" id="mission">
            <HoleBackground className="absolute inset-0 z-0" />
            <div className="container relative z-10">
                <div className="content-wrapper">
                    <h2>
                        <span className="line-one">The market never sleeps</span>
                        <span className="italic-grey">You do.</span>
                    </h2>
                    <div className="manifesto-content">
                        <p>Don't let your portfolio pause just because you do. Rez empowers you to deploy non-custodial AI agents that monitor and trade perpetual markets 24/7. Your strategy, our infrastructure, always awake.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Mission;
