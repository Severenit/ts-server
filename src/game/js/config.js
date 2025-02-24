const config = {
    development: {
        apiUrl: 'http://localhost:3000/api',
        imagesUrl: '/img'
    },
    production: {
        apiUrl: '/api',
        imagesUrl: '/img'
    }
};

const environment = window.location.hostname === 'localhost' ? 'development' : 'production';

export default {
    apiUrl: config[environment].apiUrl,
    imagesUrl: config[environment].imagesUrl
}; 