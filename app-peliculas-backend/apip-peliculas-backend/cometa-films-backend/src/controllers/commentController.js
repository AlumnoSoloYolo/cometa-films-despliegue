// controllers/commentController.js
const User = require('../models/user.model');
const Review = require('../models/review.model');
const Comment = require('../models/comment.model');
const mongoose = require('mongoose');

// Obtener comentarios de una reseña
exports.getComments = async (req, res) => {
  try {
    const { reviewId } = req.params;

    // Verificar si la reseña existe
    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Reseña no encontrada' });
    }

    // Buscar todos los comentarios de la reseña
    const comments = await Comment.find({ reviewId }).sort({ createdAt: 1 });

    // Para cada comentario, buscar y añadir información del usuario
    const commentsWithUserInfo = await Promise.all(comments.map(async (comment) => {
      const commentUser = await User.findById(comment.userId, 'username avatar');
      return {
        _id: comment._id,
        text: comment.text,
        userId: comment.userId,
        username: commentUser ? commentUser.username : 'Usuario desconocido',
        avatar: commentUser ? commentUser.avatar : 'avatar1',
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        isEdited: comment.isEdited,
        editedAt: comment.editedAt
      };
    }));

    res.json(commentsWithUserInfo);
  } catch (error) {
    console.error('Error al obtener comentarios:', error);
    res.status(500).json({
      message: 'Error al obtener comentarios',
      error: error.message
    });
  }
};

// Añadir un comentario a una reseña
exports.addComment = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { text, parentId } = req.body;
    const userId = req.user.id;

    // Validar texto del comentario
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'El comentario no puede estar vacío' });
    }

    if (text.length > 500) {
      return res.status(400).json({ message: 'El comentario no puede exceder los 500 caracteres' });
    }

    // Verificar si la reseña existe
    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ message: 'Reseña no encontrada' });
    }

    // Si es una respuesta, verificar que el comentario padre existe
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        return res.status(404).json({ message: 'Comentario padre no encontrado' });
      }
    }

    // Crear nuevo comentario
    const newComment = await Comment.create({
      reviewId,
      userId,
      text,
      parentId: parentId || null,
      createdAt: new Date(),
      isEdited: false
    });

    // Buscar información del usuario para incluir en la respuesta
    const commentUser = await User.findById(userId, 'username avatar');

    // Devolver el comentario con información del usuario
    res.status(201).json({
      _id: newComment._id,
      text: newComment.text,
      userId: newComment.userId,
      username: commentUser.username,
      avatar: commentUser.avatar,
      parentId: newComment.parentId,
      createdAt: newComment.createdAt,
      isEdited: newComment.isEdited,
      editedAt: newComment.editedAt
    });
  } catch (error) {
    console.error('Error al añadir comentario:', error);
    res.status(500).json({
      message: 'Error al añadir comentario',
      error: error.message
    });
  }
};

// Editar un comentario
exports.editComment = async (req, res) => {
  try {
    const { reviewId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    // Validar texto del comentario
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'El comentario no puede estar vacío' });
    }

    if (text.length > 500) {
      return res.status(400).json({ message: 'El comentario no puede exceder los 500 caracteres' });
    }

    // Buscar el comentario
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comentario no encontrado' });
    }

    // Verificar que la reseña existe
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Reseña no encontrada' });
    }

    // Verificar que el usuario es el autor del comentario
    if (comment.userId.toString() !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para editar este comentario' });
    }

    // Actualizar el comentario
    comment.text = text;
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();

    // Buscar información del usuario para incluir en la respuesta
    const commentUser = await User.findById(userId, 'username avatar');

    // Devolver el comentario actualizado
    res.json({
      _id: comment._id,
      text: comment.text,
      userId: comment.userId,
      username: commentUser.username,
      avatar: commentUser.avatar,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt
    });
  } catch (error) {
    console.error('Error al editar comentario:', error);
    res.status(500).json({
      message: 'Error al editar comentario',
      error: error.message
    });
  }
};

// Eliminar un comentario
exports.deleteComment = async (req, res) => {
  try {
    const { reviewId, commentId } = req.params;
    const userId = req.user.id;

    // Buscar el comentario
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comentario no encontrado' });
    }

    // Verificar que la reseña existe
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Reseña no encontrada' });
    }

    // Verificar permisos (autor del comentario o de la reseña)
    const isCommentAuthor = comment.userId.toString() === userId;
    const isReviewAuthor = review.userId.toString() === userId;

    if (!isCommentAuthor && !isReviewAuthor) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este comentario' });
    }

    // Eliminar respuestas al comentario
    await Comment.deleteMany({ parentId: commentId });

    // Eliminar el comentario
    await Comment.findByIdAndDelete(commentId);

    res.json({ message: 'Comentario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar comentario:', error);
    res.status(500).json({
      message: 'Error al eliminar comentario',
      error: error.message
    });
  }
};