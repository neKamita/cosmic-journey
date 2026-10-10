import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import {
  BLACK_HOLE,
  EARTH,
  GALAXY,
  JUPITER,
  MARS,
  MERCURY,
  MOON,
  NEPTUNE,
  SATURN,
  SUN,
  URANUS,
  VENUS,
  type BodyLayout,
} from '../config/layout';
import type { FrameContext } from '../core/frame';
import type { SceneModule } from './SceneModule';

/**
 * Temporary stand-ins for bodies whose real module is not built yet. Each real module removes its
 * placeholder by id via `remove()`.
 */
export class Placeholders implements SceneModule {
  readonly id = 'placeholders';
  readonly root = new Group();
  private readonly bodies = new Map<string, Mesh>();
  private readonly sphere = new SphereGeometry(1, 48, 24);

  constructor() {
    this.addBody('sun', SUN, new MeshBasicMaterial({ color: new Color(1, 0.72, 0.35).multiplyScalar(4) }));
    this.addPlanet('earth', EARTH, '#3b6fb6');
    this.addPlanet('moon', MOON, '#9a9a9a');
    this.addPlanet('mercury', MERCURY, '#8c8279');
    this.addPlanet('venus', VENUS, '#d8c08a');
    this.addPlanet('mars', MARS, '#b5552f');
    this.addPlanet('jupiter', JUPITER, '#c9a27a');
    const saturn = this.addPlanet('saturn', SATURN, '#d8c391');
    const ring = new Mesh(
      new RingGeometry(1.25, 2.3, 96),
      new MeshStandardMaterial({ color: '#cbb894', side: DoubleSide, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = -Math.PI / 2;
    saturn.add(ring);
    this.addPlanet('uranus', URANUS, '#8fd0dc');
    this.addPlanet('neptune', NEPTUNE, '#3f62c9');

    const hole = new Mesh(this.sphere, new MeshBasicMaterial({ color: '#000000' }));
    hole.scale.setScalar(BLACK_HOLE.horizon);
    const disk = new Mesh(
      new TorusGeometry(BLACK_HOLE.horizon * 4, BLACK_HOLE.horizon * 1.2, 16, 96),
      new MeshBasicMaterial({ color: new Color(1, 0.55, 0.25).multiplyScalar(3) }),
    );
    disk.quaternion.copy(GALAXY.orientation);
    disk.rotateX(Math.PI / 2);
    hole.position.copy(BLACK_HOLE.position);
    disk.position.copy(BLACK_HOLE.position);
    this.root.add(hole, disk);
    this.bodies.set('blackhole', hole);
    this.bodies.set('blackhole-disk', disk);
  }

  remove(id: string): void {
    const mesh = this.bodies.get(id);
    if (!mesh) return;
    mesh.removeFromParent();
    this.bodies.delete(id);
  }

  update(ctx: FrameContext): void {
    for (const mesh of this.bodies.values()) mesh.rotation.y = ctx.time * 0.05;
  }

  private addPlanet(id: string, layout: BodyLayout, color: string): Mesh {
    const material = new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
    return this.addBody(id, layout, material);
  }

  private addBody(id: string, layout: BodyLayout, material: MeshStandardMaterial | MeshBasicMaterial): Mesh {
    const mesh = new Mesh(this.sphere, material);
    mesh.position.copy(layout.position);
    mesh.scale.setScalar(layout.radius);
    mesh.rotation.z = layout.tilt;
    this.root.add(mesh);
    this.bodies.set(id, mesh);
    return mesh;
  }
}
