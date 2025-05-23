import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments';


interface Review {
  reviewId?: string;
  movieId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  username?: string;
  avatar?: string;
  userId?: string;
  _id?: string;
}


export interface ReviewResponse {
  message: string;
  review: Review;
}

interface ReviewsPeli {
  movie: string;
  totalReviews: number;
  reviews: Review[];
}


export interface Comment {
  _id?: string;
  text: string;
  userId: string;
  username: string;
  avatar: string;
  parentId?: string | null;
  createdAt: Date;
  isEdited?: boolean;
  editedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})

export class UserMovieService {

  private apiUrl = environment.apiUrl;


  constructor(private http: HttpClient) { }

  private getToken(): string | null {
    return localStorage.getItem('token');

  }


  private getHeaders(): { headers: HttpHeaders } {
    const token = this.getToken();
    return {
      headers: new HttpHeaders()
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token || ''}`)
    };
  }


  addPelisPendientes(movieId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/user-movies/watchlist`,
      { movieId },
      this.getHeaders()
    );
  }

  removePelisPendientes(movieId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/user-movies/watchlist`,
      {
        headers: this.getHeaders().headers,
        body: { movieId }
      }
    );
  }

  addPelisVistas(movieId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/user-movies/watched`,
      { movieId },
      this.getHeaders()
    );
  }

  removePelisVistas(movieId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/user-movies/watched`,
      {
        headers: this.getHeaders().headers,
        body: { movieId }
      }
    );
  }

  getUserPerfil(): Observable<any> {

    return this.http.get(
      `${this.apiUrl}/user-movies/profile`,
      this.getHeaders()
    );
  }

  updateUserProfile(userData: {
    username?: string,
    avatar?: string,
    biografia?: string,
    perfilPrivado?: boolean
  }): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/user-movies/profile/update`,
      userData,
      this.getHeaders()
    );
  }

  deleteAccount(): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/user-movies/profile/delete`,
      this.getHeaders()
    );
  }


  getReviewsUsuario(): Observable<Review[]> {
    return this.http.get<Review[]>(
      `${this.apiUrl}/user-movies/reviews`,
      this.getHeaders()
    )
  }

  getReviewsPelicula(movieId: string): Observable<ReviewsPeli> {
    return this.http.get<ReviewsPeli>(
      `${this.apiUrl}/user-movies/movies/${movieId}/reviews`,
      this.getHeaders()
    );
  }

  getReviewsByMovieId(movieId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/user-movies/reviews/${movieId}`,
      this.getHeaders()
    );
  }


  getReviewById(reviewId: string): Observable<Review> {
    return this.http.get<Review>(
      `${this.apiUrl}/user-movies/reviews/${reviewId}`,
      this.getHeaders()
    );
  }

  addReview(movieId: string, review: {
    rating: number;
    comment: string;
  }): Observable<Review> {
    return this.http.post<Review>(
      `${this.apiUrl}/user-movies/reviews`,
      { movieId, ...review },
      this.getHeaders()
    );
  }


  updateReview(movieId: string, review: {
    rating: number;
    comment: string;
  }): Observable<ReviewResponse> {
    return this.http.put<ReviewResponse>(
      `${this.apiUrl}/user-movies/reviews/${movieId}`,
      review,
      this.getHeaders()
    );
  }


  deleteReview(movieId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/user-movies/reviews/${movieId}`,
      this.getHeaders()
    );
  }



  getReviewComments(reviewId: string): Observable<Comment[]> {
    return this.http.get<Comment[]>(
      `${this.apiUrl}/comments/reviews/${reviewId}/comments`,
      this.getHeaders()
    );
  }


  addComment(reviewId: string, text: string, parentId?: string | null): Observable<Comment> {
    return this.http.post<Comment>(
      `${this.apiUrl}/comments/reviews/${reviewId}/comments`,
      { text, parentId },
      this.getHeaders()
    );
  }


  editComment(reviewId: string, commentId: string, text: string): Observable<Comment> {
    return this.http.put<Comment>(
      `${this.apiUrl}/comments/reviews/${reviewId}/comments/${commentId}`,
      { text },
      this.getHeaders()
    );
  }


  deleteComment(reviewId: string, commentId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/comments/reviews/${reviewId}/comments/${commentId}`,
      this.getHeaders()
    );
  }


}