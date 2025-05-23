const mongoose = require('mongoose');

const watchedSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    movieId: {
        type: String,
        required: true
    },
    watchedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});


watchedSchema.index({ userId: 1, movieId: 1 }, { unique: true });

module.exports = mongoose.model('Watched', watchedSchema);