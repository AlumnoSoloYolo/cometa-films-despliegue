export interface User {
    _id: string;
    username: string;
    avatar: string;
    pelisVistasCount: number;
    pelisPendientesCount: number;
    reviewsCount: number;
    isFollowing?: boolean;
    hovering?: boolean;
}

export interface UserResponse {
    users: User[];
    pagination: {
        total: number;
        page: number;
        totalPages: number;
        hasMore: boolean;
    };
}

export interface UserProfile extends User {
    email?: string;
    bio?: string;
    pelisVistas?: {
        movieId: string;
        watchedAt: Date;
    }[];
    pelisPendientes?: {
        movieId: string;
        addedAt: Date;
    }[];
    reviews?: {
        _id: string;
        movieId: string;
        rating: number;
        comment: string;
        createdAt: Date;
    }[];
    following?: string[];
    followers?: string[];
    stats?: {
        pelisVistasCount: number;
        pelisPendientesCount: number;
        reviewsCount: number;
        followingCount?: number;
        followersCount?: number;
    };
}