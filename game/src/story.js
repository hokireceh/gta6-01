// Vice Bay's story: four missions for Dario Voss, a wheelman new to the city.
// Sable, the fixer at the Harbor garage, lines the jobs up; each one pays in
// cash and teaches one system (stealing a car, carrying a package under heat,
// losing the cops, and the final escape). The Story only tracks stages and
// markers — boot.js owns the world it reads through the ctx it is given.
//
//   ctx: { px, py, inCar, interact, wanted, addCash(n), banner(text, secs),
//          onMissionDone(mission), onWin() }

import { dist } from './tools.js';

export const MISSION_DEFS = [
  {
    id: 'wheels',
    title: 'First Wheels',
    briefing: "Sable needs wheels. Steal any car on the street and bring it to my garage at the Harbor. Don't scratch it. Much.",
    reward: 300,
  },
  {
    id: 'marina',
    title: 'Marina Pickup',
    briefing: 'A crate is waiting on the marina pier. Grab it and run it to the Neon Strip. The cops watch that pier — expect company.',
    reward: 600,
  },
  {
    id: 'heat',
    title: 'Lose the Heat',
    briefing: 'Three stars, Dario. Break line of sight, stay quiet, and let the heat die. Then come home to the hideout in Old Town.',
    reward: 900,
  },
  {
    id: 'job',
    title: 'The Bay Job',
    briefing: 'The bank van parks downtown at noon. Take the bag, take the heat, and vanish down the docks. This one makes us.',
    reward: 2500,
  },
];

export class Story {
  constructor(city) {
    this.city = city;
    this.index = 0;
    this.stage = 'start';
    this.marker = null;
    this.finished = false;
    this.banner = '';
    this.bannerTimer = 0;
  }

  current() {
    return MISSION_DEFS[this.index];
  }

  get title() {
    return this.finished ? 'Vice Bay' : this.current().title;
  }

  get progressLabel() {
    return this.finished ? 'All jobs done' : `Job ${this.index + 1} of ${MISSION_DEFS.length}`;
  }

  /** (Re)starts the current mission from its first stage. */
  start(ctx) {
    const m = this.current();
    this.stage = 'start';
    if (m.id === 'wheels') {
      this.marker = null;
      ctx.banner(`JOB ${this.index + 1}: ${m.title} — steal any car.`, 6);
    } else if (m.id === 'marina') {
      this.marker = { ...this.city.marinaCrate, radius: 70 };
      ctx.banner(`JOB ${this.index + 1}: ${m.title} — reach the crate on the pier.`, 6);
    } else if (m.id === 'heat') {
      ctx.wanted.setStars(3);
      this.marker = null;
      ctx.banner(`JOB ${this.index + 1}: ${m.title} — break away until the stars are gone.`, 6);
    } else if (m.id === 'job') {
      this.marker = { ...this.city.bankVan, radius: 80 };
      ctx.banner(`JOB ${this.index + 1}: ${m.title} — reach the bank van downtown.`, 6);
    }
    this.stage = 'go';
  }

  /** One line for the HUD objective slot. */
  objective() {
    if (this.finished) return 'Vice Bay is yours. Free roam — stay rich, stay free.';
    const m = this.current();
    if (m.id === 'wheels') return this.stage === 'go' ? 'Steal a car (walk up and press E)' : "Drive it to Sable's Garage";
    if (m.id === 'marina') return this.stage === 'go' ? 'Reach the crate on the marina pier (press E)' : 'Deliver the package to the Neon Strip';
    if (m.id === 'heat') return this.stage === 'go' ? 'Lose the cops — stay out of sight until the stars clear' : 'Reach the hideout in Old Town';
    if (m.id === 'job') return this.stage === 'go' ? 'Reach the bank van (press E to grab the bag)' : 'Escape to the docks!';
    return m.title;
  }

  /** Advances the story one frame. */
  update(ctx) {
    if (this.finished) return;
    const m = this.current();
    const near = (pt, radius) => dist(ctx.px, ctx.py, pt.x, pt.y) < radius;
    if (m.id === 'wheels') {
      if (this.stage === 'go' && ctx.inCar) {
        this.stage = 'deliver';
        this.marker = { ...this.city.garage, radius: 90 };
        ctx.banner("Wheels secured. Now bring it to Sable's Garage.", 5);
      } else if (this.stage === 'deliver' && ctx.inCar && near(this.city.garage, 95)) {
        this.complete(ctx);
      }
    } else if (m.id === 'marina') {
      if (this.stage === 'go' && near(this.city.marinaCrate, 70) && ctx.interact) {
        this.stage = 'carry';
        this.marker = { ...this.city.stripDrop, radius: 80 };
        ctx.wanted.addHeat(28);
        ctx.banner('Package taken — the cops saw that. Run it to the Strip!', 5);
      } else if (this.stage === 'carry' && near(this.city.stripDrop, 85)) {
        this.complete(ctx);
      }
    } else if (m.id === 'heat') {
      if (this.stage === 'go' && ctx.wanted.stars === 0) {
        this.stage = 'hideout';
        this.marker = { ...this.city.hideout, radius: 90 };
        ctx.banner('Heat is gone. Get to the hideout.', 5);
      } else if (this.stage === 'hideout' && near(this.city.hideout, 95)) {
        this.complete(ctx);
      }
    } else if (m.id === 'job') {
      if (this.stage === 'go' && near(this.city.bankVan, 80) && ctx.interact) {
        this.stage = 'escape';
        this.marker = { ...this.city.docksEscape, radius: 90 };
        ctx.wanted.setStars(4);
        ctx.banner('Bag grabbed! Four stars — vanish down the docks!', 5);
      } else if (this.stage === 'escape' && near(this.city.docksEscape, 95)) {
        this.complete(ctx);
        ctx.onWin();
      }
    }
  }

  complete(ctx) {
    const m = this.current();
    ctx.addCash(m.reward);
    ctx.banner(`JOB DONE: ${m.title} — +$${m.reward}.`, 5);
    this.index++;
    this.marker = null;
    if (this.index >= MISSION_DEFS.length) {
      this.finished = true;
      return;
    }
    ctx.onMissionDone(m);
    this.start(ctx);
  }
}
