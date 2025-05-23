
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments';
import { UserResponse, User, UserProfile } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserSocialService {
  private apiUrl = environment.apiUrl + '/social';

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

  getAllUsers(page: number = 1, limit: number = 12): Observable<UserResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<UserResponse>(
      `${this.apiUrl}/users`,
      { headers: this.getHeaders().headers, params }
    );
  }

  searchUsers(username: string): Observable<User[]> {
    const params = new HttpParams().set('username', username);

    return this.http.get<User[]>(
      `${this.apiUrl}/users/search`,
      { headers: this.getHeaders().headers, params }
    );
  }

  getUserProfile(userId: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(
      `${this.apiUrl}/users/${userId}`,
      this.getHeaders()
    );
  }


  followUser(userId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/follow/${userId}`,
      {},
      this.getHeaders()
    );
  }

  unfollowUser(userId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/follow/${userId}`,
      this.getHeaders()
    );
  }

  getUserFollowers(userId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/users/${userId}/followers`,
      this.getHeaders()
    );
  }

  getUserFollowing(userId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/users/${userId}/following`,
      this.getHeaders()
    );
  }


  getFollowStatus(userId: string): Observable<{ status: 'none' | 'requested' | 'following' }> {
    return this.http.get<{ status: 'none' | 'requested' | 'following' }>(
      `${this.apiUrl}/follow/${userId}/status`,
      this.getHeaders()
    );
  }

  getPendingFollowRequests(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/follow/requests`,
      this.getHeaders()
    );
  }

  acceptFollowRequest(requestId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/follow/requests/${requestId}/accept`,
      {},
      this.getHeaders()
    );
  }

  rejectFollowRequest(requestId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/follow/requests/${requestId}/reject`,
      {},
      this.getHeaders()
    );
  }

  cancelFollowRequest(requestId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/follow/requests/${requestId}/cancel`,
      this.getHeaders()
    );
  }

  removeFollower(followerId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/follower/${followerId}/remove`,
      this.getHeaders()
    );
  }
}