import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PremiumCancelComponent } from './premium-cancel.component';

describe('PremiumCancelComponent', () => {
  let component: PremiumCancelComponent;
  let fixture: ComponentFixture<PremiumCancelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PremiumCancelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PremiumCancelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
