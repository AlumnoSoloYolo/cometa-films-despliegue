
const mongoose = require('mongoose');

// Schema para comentarios
const commentSchema = {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null   // Si es null, es un comentario principal. Si no, es una respuesta.
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  }
};

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    enum: [
      'avatar1', 'avatar2', 'avatar3', 'avatar4',
      'avatar5', 'avatar6', 'avatar7', 'avatar8'
    ],
    default: 'avatar1'
  },
  // Lista de películas pendientes por ver
  pelisPendientes: [{
    movieId: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Lista de películas ya vistas
  pelisVistas: [{
    movieId: String,
    watchedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Reseñas de películas
  reviews: [{
    movieId: String,
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },
    comment: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    // array de comentarios a cada reseña
    comments: [commentSchema]
  }],
  // Lista de usuarios que este usuario sigue
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Lista de usuarios que siguen a este usuario
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);