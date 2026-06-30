import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface Annotation {
  id: string;
  videoId: string;
  timecode: number; // position en secondes dans la vidéo
  x: number; // position horizontale en % (0-100)
  y: number; // position verticale en % (0-100)
  text: string;
  author: string;
  createdAt: string;
}

/**
 * Pôle 1 - Sujet A : Lecteur de Revue augmenté.
 * Annotations rattachées à un timecode, synchronisées en temps réel
 * via WebSockets entre tous les utilisateurs connectés à la même vidéo.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class AnnotationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // videoId -> liste d'annotations (en mémoire, suffisant pour la démo)
  private annotationsByVideo = new Map<string, Annotation[]>();
  // videoId -> nombre de connectés (pour affichage "X personnes en revue")
  private viewersByVideo = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    console.log(`Client connecté : ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    for (const [videoId, viewers] of this.viewersByVideo) {
      if (viewers.delete(client.id)) {
        this.server.to(videoId).emit('viewers-count', viewers.size);
      }
    }
  }

  @SubscribeMessage('join-video')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { videoId: string }) {
    client.join(data.videoId);

    if (!this.viewersByVideo.has(data.videoId)) {
      this.viewersByVideo.set(data.videoId, new Set());
    }
    this.viewersByVideo.get(data.videoId)!.add(client.id);

    // envoie l'historique des annotations existantes au nouvel arrivant
    const existing = this.annotationsByVideo.get(data.videoId) || [];
    client.emit('annotations-history', existing);
    this.server.to(data.videoId).emit('viewers-count', this.viewersByVideo.get(data.videoId)!.size);
  }

  @SubscribeMessage('add-annotation')
  handleAddAnnotation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: Omit<Annotation, 'id' | 'createdAt'>,
  ) {
    const annotation: Annotation = {
      ...data,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };

    if (!this.annotationsByVideo.has(data.videoId)) {
      this.annotationsByVideo.set(data.videoId, []);
    }
    this.annotationsByVideo.get(data.videoId)!.push(annotation);

    // diffuse à TOUS les utilisateurs sur cette vidéo (y compris l'auteur, pour confirmation)
    this.server.to(data.videoId).emit('new-annotation', annotation);
  }

  @SubscribeMessage('export-annotations')
  handleExport(@ConnectedSocket() client: Socket, @MessageBody() data: { videoId: string }) {
    const annotations = this.annotationsByVideo.get(data.videoId) || [];
    client.emit('annotations-export', annotations);
  }
}
