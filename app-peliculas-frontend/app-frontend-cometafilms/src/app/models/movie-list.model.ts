export interface MovieInList {
    movieId: string;
    addedAt: Date;
}

export interface MovieList {
    _id: string;
    userId: string;
    title: string;
    description: string;
    coverImage: string | null;
    movies: MovieInList[];
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ListsResponse {
    lists: MovieList[];
    isPremium?: boolean;
    totalLists?: number;
    hiddenLists?: number;
}