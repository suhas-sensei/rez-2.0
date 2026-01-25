import React from 'react';

const Ticker = () => {
    const tickers = [
        { symbol: 'BTC', price: '$98,432.10', change: '+2.4%' },
        { symbol: 'ETH', price: '$3,892.45', change: '+1.8%' },
        { symbol: 'SOL', price: '$145.20', change: '+4.2%' },
        { symbol: 'AVAX', price: '$42.15', change: '+0.5%' },
        { symbol: 'LINK', price: '$18.90', change: '-0.2%' },
        { symbol: 'DOT', price: '$8.45', change: '+1.1%' },
        { symbol: 'MATIC', price: '$0.92', change: '+0.8%' },
        { symbol: 'UNI', price: '$12.30', change: '+3.5%' },
        { symbol: 'AAVE', price: '$110.50', change: '-1.2%' },
        { symbol: 'MKR', price: '$2,450.00', change: '+0.9%' },
    ];

    // Duplicate the list to ensure seamless scrolling
    const displayTickers = [...tickers, ...tickers];

    return (
        <div className="ticker-wrap">
            <div className="ticker">
                {displayTickers.map((item, index) => (
                    <div className="ticker-item" key={index}>
                        <span className="ticker-symbol">{item.symbol}</span>
                        <span className="ticker-price">{item.price}</span>
                        <span className={`ticker-change ${item.change.startsWith('+') ? 'positive' : 'negative'}`}>
                            {item.change}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Ticker;
